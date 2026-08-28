import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { InventoryItem } from './inventory-item.schema';

export type InventoryReservationDocument =
  HydratedDocument<InventoryReservation>;

export type InventoryReservationStatus = 'active' | 'consumed' | 'released';

// SCOPE.md Phase 3 — reservations expire via a Mongo TTL index, not a
// cron sweep. `expiresAt` is what the TTL index targets: MongoDB deletes
// the document automatically once it's past, which is why release logic
// is a no-op for the (common) timeout case — there's nothing left to
// clean up. The checkout saga (S9) still transitions `status` to
// 'released' on an explicit cancellation, ahead of the TTL, so an order
// state query never has to guess whether a reservation quietly expired
// or was actively let go.
@Schema(baseSchemaOptions)
export class InventoryReservation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: InventoryItem.name,
    required: true,
    index: true,
  })
  inventoryItemId!: Types.ObjectId;

  // Whichever cart or order this reservation backs — exactly one is set.
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  cartId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  orderId?: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({
    type: String,
    enum: ['active', 'consumed', 'released'],
    required: true,
    default: 'active',
  })
  status!: InventoryReservationStatus;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const InventoryReservationSchema =
  SchemaFactory.createForClass(InventoryReservation);

// expireAfterSeconds: 0 — the document is removed at the exact time
// stored in `expiresAt`, not N seconds after. This is the TTL index
// itself; MongoDB's background task sweeps it roughly every 60s.
InventoryReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
