import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PaginatedResult } from '@/catalog/products.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { CartService } from '@/cart/cart.service';
import { Order, OrderDocument } from './schemas/order.schema';

export interface TrackingInfo {
  orderNumber: string;
  status: string;
  city: string;
  countryCode: string;
  placedAt: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly cartService: CartService,
  ) {}

  async findMine(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<OrderDocument>> {
    const { page = 1, take = 30 } = query;
    const filter = { userId };

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findOwned(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel
      .findOne({ _id: orderId, userId })
      .exec();
    if (!order) {
      // 404, not 403 — doesn't confirm to the caller that an order with
      // this id exists at all, just that they can't see it.
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }
    return order;
  }

  /** Public tracking — deliberately minimal fields, and requires the order's own email to view even that much. */
  async trackByOrderNumber(
    orderNumber: string,
    email: string,
  ): Promise<TrackingInfo> {
    const order = await this.orderModel
      .findOne({ orderNumber, 'shippingAddress.fullName': { $exists: true } })
      .populate<{ userId: { email: string } }>('userId', 'email')
      .exec();

    if (!order || order.userId.email.toLowerCase() !== email.toLowerCase()) {
      throw new NotFoundException(
        'No order found matching that order number and email',
      );
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      city: order.shippingAddress.city,
      countryCode: order.shippingAddress.countryCode,
      // Document.get() is typed `any` by mongoose — no cast needed, the
      // TrackingInfo return type above already tells TS what this is.
      placedAt: order.get('createdAt'),
    };
  }

  /** Adds every line from a past order to the customer's current cart. */
  async reorder(orderId: string, userId: string): Promise<void> {
    const order = await this.findOwned(orderId, userId);
    const { cart } = await this.cartService.resolveCart({ userId });

    for (const item of order.items) {
      await this.cartService.addItem(cart.id, {
        productId: item.productId.toString(),
        variantSku: item.variantSku,
        quantity: item.quantity,
      });
    }
  }
}
