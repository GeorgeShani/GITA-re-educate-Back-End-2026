import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import {
  Product,
  ProductDocument,
} from '../../../catalog/schemas/product.schema';
import { Coupon, CouponDocument } from '../../../coupons/schemas/coupon.schema';
import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { CartPricingService } from '../../cart-pricing.service';
import { CartCouponAppliedEvent } from '../../events/cart-coupon-applied.event';
import { Cart, CartDocument } from '../../schemas/cart.schema';
import { ApplyCouponCommand } from '../apply-coupon.command';

@CommandHandler(ApplyCouponCommand)
export class ApplyCouponHandler
  extends TransactionalCommandHandler<ApplyCouponCommand>
  implements ICommandHandler<ApplyCouponCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly cartPricingService: CartPricingService,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ApplyCouponCommand): Promise<CartDocument> {
    const code = command.couponCode.toUpperCase();
    const coupon = await this.couponModel.findOne({ code, isActive: true });
    const now = new Date();

    if (
      !coupon ||
      coupon.startsAt > now ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw new BadRequestException(
        `Coupon "${command.couponCode}" is not valid`,
      );
    }

    return this.withTransaction(async (session) => {
      const cart = await this.cartModel
        .findById(command.cartId)
        .session(session);
      if (!cart) {
        throw new NotFoundException(`Cart with id ${command.cartId} not found`);
      }

      const subtotalMinor = await this.cartPricingService.computeSubtotalMinor(
        cart.items,
      );
      if (subtotalMinor < coupon.minSpendMinor) {
        throw new BadRequestException(
          `This coupon requires a minimum spend of ${(coupon.minSpendMinor / 100).toFixed(2)}`,
        );
      }

      // Scoped coupons (product/category restricted) need at least one
      // qualifying line in the cart. Full redemption-limit enforcement
      // (CouponRedemption ledger, per-user/global caps) happens at
      // checkout in S9 — this is eligibility only, a UX preview.
      const isScoped =
        coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
      if (isScoped) {
        const cartProductIds = cart.items.map((item) => item.productId);
        const matchesProduct = cart.items.some((item) =>
          coupon.productIds.some((id) => id.equals(item.productId)),
        );

        let matchesCategory = false;
        if (!matchesProduct && coupon.categoryIds.length > 0) {
          const products = await this.productModel
            .find({ _id: { $in: cartProductIds } })
            .session(session);
          matchesCategory = products.some((product) =>
            coupon.categoryIds.some((id) => id.equals(product.categoryId)),
          );
        }

        if (!matchesProduct && !matchesCategory) {
          throw new BadRequestException(
            'This coupon does not apply to any items in your cart',
          );
        }
      }

      cart.couponCode = code;
      await cart.save({ session });

      await this.outboxRepository.write(
        new CartCouponAppliedEvent(cart.id, code, command.correlationId),
        session,
      );

      return cart;
    });
  }
}
