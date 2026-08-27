import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { StockAdjustedEvent } from '../../events/stock-adjusted.event';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../../schemas/inventory-item.schema';
import {
  StockAdjustment,
  StockAdjustmentDocument,
} from '../../schemas/stock-adjustment.schema';
import { AdjustStockCommand } from '../adjust-stock.command';

// The manual-correction counterpart to ConfirmOrderHandler's
// decrementStockAndConsumeReservations — same InventoryItem +
// StockAdjustment write pattern, just admin-initiated instead of
// order-driven, which is exactly what adjustedByUserId/reasonCode were
// sitting unused for since S7.
@CommandHandler(AdjustStockCommand)
export class AdjustStockHandler
  extends TransactionalCommandHandler<AdjustStockCommand>
  implements ICommandHandler<AdjustStockCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(StockAdjustment.name)
    private readonly stockAdjustmentModel: Model<StockAdjustmentDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: AdjustStockCommand): Promise<InventoryItemDocument> {
    return this.withTransaction(async (session) => {
      const item = await this.inventoryItemModel
        .findById(command.inventoryItemId)
        .session(session);
      if (!item) {
        throw new NotFoundException(
          `Inventory item with id ${command.inventoryItemId} not found`,
        );
      }

      const nextQuantity = item.quantityOnHand + command.delta;
      if (nextQuantity < 0) {
        throw new BadRequestException(
          `Adjustment would take quantityOnHand negative (${item.quantityOnHand} + ${command.delta})`,
        );
      }

      item.quantityOnHand = nextQuantity;
      await item.save({ session });

      await this.stockAdjustmentModel.create(
        [
          {
            inventoryItemId: item._id,
            delta: command.delta,
            reasonCode: command.reasonCode,
            note: command.note,
            adjustedByUserId: new Types.ObjectId(command.adjustedByUserId),
          },
        ],
        { session },
      );

      await this.outboxRepository.write(
        new StockAdjustedEvent(
          item.id,
          command.delta,
          command.reasonCode,
          command.correlationId,
        ),
        session,
      );

      return item;
    });
  }
}
