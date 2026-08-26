import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { CoreModule } from '../core/core.module';
import { Coupon, CouponSchema } from '../coupons/schemas/coupon.schema';
import { AddCartItemHandler } from './commands/handlers/add-cart-item.handler';
import { ApplyCouponHandler } from './commands/handlers/apply-coupon.handler';
import { MergeGuestCartHandler } from './commands/handlers/merge-guest-cart.handler';
import { RemoveCartItemHandler } from './commands/handlers/remove-cart-item.handler';
import { UpdateCartItemQuantityHandler } from './commands/handlers/update-cart-item-quantity.handler';
import { CartController } from './cart.controller';
import { CartPricingService } from './cart-pricing.service';
import { CartService } from './cart.service';
import { Cart, CartSchema } from './schemas/cart.schema';

const COMMAND_HANDLERS = [
  AddCartItemHandler,
  UpdateCartItemQuantityHandler,
  RemoveCartItemHandler,
  ApplyCouponHandler,
  MergeGuestCartHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Coupon.name, schema: CouponSchema },
    ]),
  ],
  controllers: [CartController],
  providers: [CartService, CartPricingService, ...COMMAND_HANDLERS],
})
export class CartModule {}
