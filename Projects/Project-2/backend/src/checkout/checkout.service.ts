import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { CartPricingService, CartLineItem } from '@/cart/cart-pricing.service';
import { Cart, CartDocument } from '@/cart/schemas/cart.schema';
import { CreatePaymentIntentCommand } from '@/payments/commands/create-payment-intent.command';
import type { CreatePaymentIntentResult } from '@/payments/commands/handlers/create-payment-intent.handler';
import { ShippingQuote, ShippingService } from '@/shipping/shipping.service';
import { TaxService } from '@/tax/tax.service';
import { OrderDocument } from '@/orders/schemas/order.schema';
import { PlaceOrderCommand } from './commands/place-order.command';
import { applyCouponToTotals } from '@/coupons/coupon-pricing.util';
import { Coupon, CouponDocument } from '@/coupons/schemas/coupon.schema';
import { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

/** A shipping option priced through to a final payable total. */
export interface ShippingQuoteWithTotal extends ShippingQuote {
  /** This option's charge after a free_shipping coupon (else = priceMinor). */
  effectivePriceMinor: number;
  /** subtotal - discount + effectivePrice + tax. What the card is charged. */
  totalMinor: number;
}

export interface CheckoutQuote {
  items: CartLineItem[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingOptions: ShippingQuoteWithTotal[];
  couponCode?: string;
}

export interface PlaceOrderResult {
  order: OrderDocument;
  clientSecret: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly cartPricingService: CartPricingService,
    private readonly shippingService: ShippingService,
    private readonly taxService: TaxService,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async getQuote(
    userId: string,
    dto: CheckoutQuoteDto,
  ): Promise<CheckoutQuote> {
    const cart = await this.cartModel
      .findOne({ userId, isConverted: false })
      .exec();
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const items = await this.cartPricingService.enrichItems(cart.items);
    const subtotalMinor = items.reduce(
      (sum, item) => sum + item.lineTotalMinor,
      0,
    );
    const weightGrams = items.reduce(
      (sum, item) => sum + item.weightGrams * item.quantity,
      0,
    );

    // The coupon is loaded the same way PlaceOrderHandler loads it, so the
    // quote and the eventual charge start from the same document.
    const [rawShippingOptions, coupon] = await Promise.all([
      this.shippingService.getQuotes(
        dto.countryCode,
        weightGrams,
        subtotalMinor,
      ),
      cart.couponCode
        ? this.couponModel.findOne({ code: cart.couponCode, isActive: true })
        : Promise.resolve(null),
    ]);

    // Discount is independent of which shipping option is chosen, so it can
    // be resolved once; tax is then charged on the discounted subtotal,
    // matching PlaceOrderHandler exactly.
    const { discountMinor } = applyCouponToTotals(coupon, subtotalMinor, 0);
    const taxMinor = await this.taxService.calculateTax(
      subtotalMinor - discountMinor,
      dto.countryCode,
      dto.region,
    );

    const shippingOptions: ShippingQuoteWithTotal[] = rawShippingOptions.map(
      (option) => {
        const effect = applyCouponToTotals(
          coupon,
          subtotalMinor,
          option.priceMinor,
        );
        return {
          ...option,
          effectivePriceMinor: effect.shippingMinor,
          totalMinor:
            subtotalMinor -
            effect.discountMinor +
            effect.shippingMinor +
            taxMinor,
        };
      },
    );

    return {
      items,
      subtotalMinor,
      discountMinor,
      taxMinor,
      shippingOptions,
      couponCode: cart.couponCode,
    };
  }

  async placeOrder(
    userId: string,
    dto: PlaceOrderDto,
  ): Promise<PlaceOrderResult> {
    // Two explicit, sequential command dispatches — not saga-triggered,
    // deliberately. Both need to complete within this one HTTP request
    // so the client gets a clientSecret back immediately; see
    // checkout.saga.ts for why the payment-*result* half of checkout
    // (webhook-driven, unpredictable timing) is the genuinely
    // saga-appropriate part and this half isn't.
    const order = await this.commandBus.execute<
      PlaceOrderCommand,
      OrderDocument
    >(
      new PlaceOrderCommand(
        userId,
        dto.shippingAddress,
        dto.billingAddress,
        dto.shippingMethod,
        dto.customerNote,
        this.correlationId(),
      ),
    );

    const { clientSecret } = await this.commandBus.execute<
      CreatePaymentIntentCommand,
      CreatePaymentIntentResult
    >(new CreatePaymentIntentCommand(order.id, this.correlationId()));

    return { order, clientSecret };
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
