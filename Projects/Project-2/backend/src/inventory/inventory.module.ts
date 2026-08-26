import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

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
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryReservation.name, schema: InventoryReservationSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
      { name: BackInStockRequest.name, schema: BackInStockRequestSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
