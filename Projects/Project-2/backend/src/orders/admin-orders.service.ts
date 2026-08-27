import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '../catalog/products.service';
import { IssueRefundCommand } from '../payments/commands/issue-refund.command';
import type { RefundDocument } from '../payments/schemas/refund.schema';
import { MarkOrderDeliveredCommand } from './commands/mark-order-delivered.command';
import { ShipOrderCommand } from './commands/ship-order.command';
import { FindOrdersAdminDto } from './dto/find-orders-admin.dto';
import { IssueRefundDto } from './dto/issue-refund.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { Order, OrderDocument } from './schemas/order.schema';

// Unlike OrdersService.findOwned, nothing here is ownership-checked —
// an admin can see and act on any order. Kept as its own service rather
// than added to OrdersService for the same reason AdminProductsService
// is separate from ProductsService: the shopper-facing service should
// never gain an accidental "see everyone's orders" code path.
@Injectable()
export class AdminOrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: FindOrdersAdminDto,
  ): Promise<PaginatedResult<OrderDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<OrderDocument> = {};
    if (query.status) filter.status = query.status;

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

  async findById(orderId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException(`Order with id ${orderId} not found`);
    }
    return order;
  }

  ship(orderId: string, dto: ShipOrderDto): Promise<OrderDocument> {
    return this.commandBus.execute(
      new ShipOrderCommand(orderId, dto, this.correlationId()),
    );
  }

  markDelivered(orderId: string): Promise<OrderDocument> {
    return this.commandBus.execute(
      new MarkOrderDeliveredCommand(orderId, this.correlationId()),
    );
  }

  async refund(orderId: string, dto: IssueRefundDto): Promise<RefundDocument> {
    // Omitted amountMinor = full refund of what the order actually
    // totalled — IssueRefundHandler still guards this against the real
    // Payment.amountMinor, so a stale/wrong totalMinor here can't
    // over-refund.
    const amountMinor =
      dto.amountMinor ?? (await this.findById(orderId)).totalMinor;

    return this.commandBus.execute(
      new IssueRefundCommand(
        orderId,
        amountMinor,
        dto.reason,
        this.correlationId(),
      ),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
