import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { InventoryItem } from './inventory-item.schema';

export type StockAdjustmentDocument = HydratedDocument<StockAdjustment>;

// Append-only ledger — every InventoryItem.quantityOnHand change writes
// one of these alongside it (order paid -> decrement, return refunded ->
// restock, etc.), so "why is stock at this number" is always answerable.
@Schema(baseSchemaOptions)
export class StockAdjustment {
  @Prop({
    type: Types.ObjectId,
    ref: InventoryItem.name,
    required: true,
    index: true,
  })
  inventoryItemId!: Types.ObjectId;

  @Prop({ required: true })
  delta!: number; // positive = restock, negative = decrement

  @Prop({ required: true, trim: true })
  reasonCode!: string; // e.g. "order_paid", "return_refunded", "manual_correction"

  @Prop({ trim: true })
  note?: string;

  // Absent for system-driven adjustments (the common case here, since
  // admin-initiated manual corrections are Phase 6, out of scope).
  @Prop({ type: Types.ObjectId })
  adjustedByUserId?: Types.ObjectId;
}

export const StockAdjustmentSchema =
  SchemaFactory.createForClass(StockAdjustment);
