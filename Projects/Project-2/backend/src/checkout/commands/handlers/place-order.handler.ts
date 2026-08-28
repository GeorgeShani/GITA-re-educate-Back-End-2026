import { randomBytes } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Cart, CartDocument } from '@/cart/schemas/cart.schema';
import { CartPricingService } from '@/cart/cart-pricing.service';
import { Coupon, CouponDocument } from '@/coupons/schemas/coupon.schema';
import {
  CouponRedemption,
  CouponRedemptionDocument,
} from '@/coupons/schemas/coupon-redemption.schema';
import {
  InventoryItem,
  InventoryItemDocument,
} from '@/inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
} from '@/inventory/schemas/inventory-reservation.schema';
import { ShippingService } from '@/shipping/shipping.service';
import { TaxService } from '@/tax/tax.service';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { OrderPlacedEvent } from '@/orders/events/order-placed.event';
import { PlaceOrderCommand } from '@/checkout/commands/place-order.command';

const RESERVATION_TTL_MINUTES = 15;

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler
  extends TransactionalCommandHandler<PlaceOrderCommand>
  implements ICommandHandler<PlaceOrderCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(CouponRedemption.name)
    private readonly couponRedemptionModel: Model<CouponRedemptionDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryReservation.name)
    private readonly reservationModel: Model<InventoryReservationDocument>,
    private readonly cartPricingService: CartPricingService,
    private readonly shippingService: ShippingService,
    private readonly taxService: TaxService,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: PlaceOrderCommand): Promise<OrderDocument> {
    const cart = await this.cartModel
      .findOne({ userId: command.userId, isConverted: false })
      .exec();
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const lineItems = await this.cartPricingService.enrichItems(cart.items);
    if (lineItems.length !== cart.items.length) {
      throw new BadRequestException(
        'One or more items in your cart are no longer available',
      );
    }

    const subtotalMinor = lineItems.reduce(
      (sum, item) => sum + item.lineTotalMinor,
      0,
    );
    const weightGrams = lineItems.reduce(
      (sum, item) => sum + item.weightGrams * item.quantity,
      0,
    );

    const shippingQuote = await this.shippingService.getRate(
      command.shippingAddress.countryCode,
      command.shippingMethod,
      weightGrams,
      subtotalMinor,
    );

    const coupon = cart.couponCode
      ? await this.couponModel.findOne({
          code: cart.couponCode,
          isActive: true,
        })
      : null;

    // Full limit enforcement (not just eligibility, which S8's
    // ApplyCouponHandler already checked) happens here, BEFORE the
    // customer is charged — rejecting a coupon after a successful
    // Stripe charge would mean either honoring an over-the-limit
    // discount or refunding a completed payment, both worse than just
    // not placing the order. The redemption ledger row itself is only
    // written once payment actually succeeds (ConfirmOrderHandler) —
    // this is a check, not yet a reservation of the coupon.
    if (coupon) {
      await this.assertCouponWithinLimits(coupon, command.userId);
    }

    const { discountMinor, shippingMinor } = this.applyCoupon(
      coupon,
      subtotalMinor,
      shippingQuote,
    );
    const taxMinor = await this.taxService.calculateTax(
      subtotalMinor - discountMinor,
      command.shippingAddress.countryCode,
      command.shippingAddress.region,
    );
    const totalMinor = subtotalMinor - discountMinor + shippingMinor + taxMinor;

    return this.withTransaction(async (session) => {
      await this.reserveInventory(cart, session);

      const [order] = await this.orderModel.create(
        [
          {
            orderNumber: this.generateOrderNumber(),
            userId: new Types.ObjectId(command.userId),
            items: lineItems.map((item) => ({
              productId: new Types.ObjectId(item.productId),
              variantSku: item.variantSku,
              nameSnapshot: item.productName,
              imageUrlSnapshot: item.imageUrl,
              unitPriceMinor: item.unitPriceMinor,
              quantity: item.quantity,
              lineTotalMinor: item.lineTotalMinor,
            })),
            shippingAddress: command.shippingAddress,
            billingAddress: command.billingAddress,
            subtotalMinor,
            discountMinor,
            shippingMinor,
            taxMinor,
            totalMinor,
            currency: 'usd',
            couponCode: coupon?.code,
            customerNote: command.customerNote,
          },
        ],
        { session },
      );

      // Link reservations to the order now that it exists — they were
      // created against the cart above (see reserveInventory).
      await this.reservationModel.updateMany(
        { cartId: cart._id, status: 'active' },
        { orderId: order._id },
        { session },
      );

      cart.isConverted = true;
      await cart.save({ session });

      await this.outboxRepository.write(
        new OrderPlacedEvent(
          order.id,
          command.userId,
          totalMinor,
          command.correlationId,
        ),
        session,
      );

      return order;
    });
  }

  private async reserveInventory(
    cart: CartDocument,
    session: ClientSession,
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000,
    );

    for (const item of cart.items) {
      const inventoryItem = await this.inventoryItemModel
        .findOne({ productId: item.productId, variantSku: item.variantSku })
        .session(session);

      if (!inventoryItem) {
        throw new NotFoundException(
          `No inventory record for ${item.productId.toString()}/${item.variantSku}`,
        );
      }

      const available =
        inventoryItem.quantityOnHand - inventoryItem.quantityReserved;
      if (available < item.quantity && !inventoryItem.backorderAllowed) {
        throw new BadRequestException(
          `Insufficient stock for ${item.variantSku}`,
        );
      }

      inventoryItem.quantityReserved += item.quantity;
      await inventoryItem.save({ session });

      await this.reservationModel.create(
        [
          {
            inventoryItemId: inventoryItem._id,
            cartId: cart._id,
            quantity: item.quantity,
            status: 'active',
            expiresAt,
          },
        ],
        { session },
      );
    }
  }

  private applyCoupon(
    coupon: CouponDocument | null,
    subtotalMinor: number,
    shippingMinor: number,
  ): { discountMinor: number; shippingMinor: number } {
    if (!coupon) {
      return { discountMinor: 0, shippingMinor };
    }

    if (coupon.type === 'percentage') {
      return {
        discountMinor: Math.round((subtotalMinor * coupon.value) / 100),
        shippingMinor,
      };
    }
    if (coupon.type === 'fixed') {
      return {
        discountMinor: Math.min(coupon.value, subtotalMinor),
        shippingMinor,
      };
    }
    // free_shipping — zeroes the shipping charge directly rather than
    // discounting the subtotal, so Order.discountMinor stays 0 for these.
    return { discountMinor: 0, shippingMinor: 0 };
  }

  private async assertCouponWithinLimits(
    coupon: CouponDocument,
    userId: string,
  ): Promise<void> {
    if (coupon.perUserLimit !== undefined) {
      const userRedemptions = await this.couponRedemptionModel.countDocuments({
        couponId: coupon._id,
        userId: new Types.ObjectId(userId),
      });
      if (userRedemptions >= coupon.perUserLimit) {
        throw new BadRequestException(
          `You've already used coupon "${coupon.code}" the maximum number of times`,
        );
      }
    }

    if (coupon.globalLimit !== undefined) {
      const totalRedemptions = await this.couponRedemptionModel.countDocuments({
        couponId: coupon._id,
      });
      if (totalRedemptions >= coupon.globalLimit) {
        throw new BadRequestException(
          `Coupon "${coupon.code}" has reached its redemption limit`,
        );
      }
    }
  }

  private generateOrderNumber(): string {
    return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }
}
