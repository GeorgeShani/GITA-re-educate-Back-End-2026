import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { CancelOrderCommand } from './commands/cancel-order.command';
import { Order, OrderDocument } from './schemas/order.schema';
import { OrderStatus } from './enums/order-status.enum';

const RESERVATION_TIMEOUT_MINUTES = 15;
const SWEEP_BATCH_SIZE = 50;

// SCOPE.md B2's checkout saga, the other half of "on failure or 15-min
// reservation timeout -> release inventory, order.cancelled". A Stripe
// PaymentIntent that's simply abandoned (the customer closes the tab)
// never fires a webhook at all — nothing else in the system would ever
// notice, so this sweep is what actually closes that gap. InventoryReservation
// itself already TTL-expires in MongoDB independently; this is what
// moves the ORDER to a terminal state to match, since Mongo's TTL
// deletion has no event hook for the application to react to.
@Injectable()
export class StaleOrderSweepService {
  private readonly logger = new Logger(StaleOrderSweepService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly commandBus: CommandBus,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    const cutoff = new Date(
      Date.now() - RESERVATION_TIMEOUT_MINUTES * 60 * 1000,
    );
    const staleOrders = await this.orderModel
      .find({ status: OrderStatus.PLACED, createdAt: { $lt: cutoff } })
      .limit(SWEEP_BATCH_SIZE)
      .exec();

    for (const order of staleOrders) {
      try {
        await this.commandBus.execute(
          new CancelOrderCommand(order.id, 'reservation_timeout', randomUUID()),
        );
      } catch (error) {
        this.logger.error(
          `Failed to cancel stale order ${order.id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
