import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { AddCartItemCommand } from './commands/add-cart-item.command';
import { ApplyCouponCommand } from './commands/apply-coupon.command';
import { MergeGuestCartCommand } from './commands/merge-guest-cart.command';
import { RemoveCartItemCommand } from './commands/remove-cart-item.command';
import { UpdateCartItemQuantityCommand } from './commands/update-cart-item-quantity.command';
import { CartLineItem, CartPricingService } from './cart-pricing.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { Cart, CartDocument } from './schemas/cart.schema';

export interface CartIdentity {
  userId?: string;
  guestToken?: string;
}

export interface ResolvedCart {
  cart: CartDocument;
  /** Set only when a fresh guest token was issued — the controller re-sets the cookie when present. */
  newGuestToken?: string;
}

export interface CartSummary {
  cartId: string;
  items: CartLineItem[];
  subtotalMinor: number;
  itemCount: number;
  couponCode?: string;
}

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly commandBus: CommandBus,
    private readonly cartPricingService: CartPricingService,
    private readonly cls: ClsService,
  ) {}

  async resolveCart(identity: CartIdentity): Promise<ResolvedCart> {
    if (identity.userId) {
      let cart = await this.cartModel
        .findOne({ userId: identity.userId })
        .exec();
      cart ??= await this.cartModel.create({
        userId: identity.userId,
        items: [],
      });
      return { cart };
    }

    if (identity.guestToken) {
      const cart = await this.cartModel
        .findOne({ guestToken: identity.guestToken, isConverted: false })
        .exec();
      if (cart) return { cart };
    }

    // No usable existing cart — issue a fresh guest identity. The
    // controller is responsible for re-setting the cookie whenever
    // newGuestToken is present, whether the old one was missing,
    // expired, or pointed at an already-converted cart.
    const newGuestToken = randomBytes(24).toString('hex');
    const cart = await this.cartModel.create({
      guestToken: newGuestToken,
      items: [],
    });
    return { cart, newGuestToken };
  }

  async getSummary(cart: CartDocument): Promise<CartSummary> {
    const items = await this.cartPricingService.enrichItems(cart.items);
    return {
      cartId: cart.id,
      items,
      subtotalMinor: items.reduce((sum, item) => sum + item.lineTotalMinor, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      couponCode: cart.couponCode,
    };
  }

  addItem(cartId: string, dto: AddCartItemDto): Promise<CartDocument> {
    return this.commandBus.execute(
      new AddCartItemCommand(
        cartId,
        dto.productId,
        dto.variantSku,
        dto.quantity,
        this.correlationId(),
      ),
    );
  }

  updateItemQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartDocument> {
    return this.commandBus.execute(
      new UpdateCartItemQuantityCommand(
        cartId,
        itemId,
        quantity,
        this.correlationId(),
      ),
    );
  }

  removeItem(cartId: string, itemId: string): Promise<CartDocument> {
    return this.commandBus.execute(
      new RemoveCartItemCommand(cartId, itemId, this.correlationId()),
    );
  }

  applyCoupon(cartId: string, code: string): Promise<CartDocument> {
    return this.commandBus.execute(
      new ApplyCouponCommand(cartId, code, this.correlationId()),
    );
  }

  async removeCoupon(cartId: string): Promise<CartDocument> {
    const cart = await this.cartModel
      .findByIdAndUpdate(cartId, { $unset: { couponCode: '' } }, { new: true })
      .exec();
    if (!cart) {
      throw new NotFoundException(`Cart with id ${cartId} not found`);
    }
    return cart;
  }

  mergeGuestCart(
    guestToken: string,
    userId: string,
  ): Promise<CartDocument | null> {
    return this.commandBus.execute(
      new MergeGuestCartCommand(guestToken, userId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
