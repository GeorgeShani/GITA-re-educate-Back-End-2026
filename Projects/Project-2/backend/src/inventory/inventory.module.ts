import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import { AdjustStockHandler } from './commands/handlers/adjust-stock.handler';
import {
  BackInStockRequest,
  BackInStockRequestSchema,
} from './schemas/back-in-stock-request.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from './schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
} from './schemas/inventory-reservation.schema';
import {
  StockAdjustment,
  StockAdjustmentSchema,
} from './schemas/stock-adjustment.schema';
import { AdminInventoryController } from './admin-inventory.controller';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryReservation.name, schema: InventoryReservationSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
      { name: BackInStockRequest.name, schema: BackInStockRequestSchema },
    ]),
  ],
  controllers: [InventoryController, AdminInventoryController],
  providers: [InventoryService, AdjustStockHandler],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
