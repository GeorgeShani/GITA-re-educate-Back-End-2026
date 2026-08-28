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
import { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

export interface CheckoutQuote {
  items: CartLineItem[];
  subtotalMinor: number;
  taxMinor: number;
  shippingOptions: ShippingQuote[];
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

    const [shippingOptions, taxMinor] = await Promise.all([
      this.shippingService.getQuotes(
        dto.countryCode,
        weightGrams,
        subtotalMinor,
      ),
      this.taxService.calculateTax(subtotalMinor, dto.countryCode, dto.region),
    ]);

    return {
      items,
      subtotalMinor,
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
