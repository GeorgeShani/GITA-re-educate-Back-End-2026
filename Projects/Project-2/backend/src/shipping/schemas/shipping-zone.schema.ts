import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

// Embedded — SCOPE.md A9: a rate only means something in the context of
// its zone, and zones/rates/methods are edited together as one unit.
@Schema({ _id: true })
export class ShippingRate {
  @Prop({ required: true, trim: true })
  method!: string; // e.g. "Standard", "Express"

  @Prop({ required: true })
  priceMinor!: number;

  @Prop()
  minWeightGrams?: number;

  @Prop()
  maxWeightGrams?: number;

  // Order subtotal at or above this waives the rate (0 = always free).
  @Prop()
  freeAboveSubtotalMinor?: number;

  @Prop()
  estimatedDaysMin?: number;

  @Prop()
  estimatedDaysMax?: number;
}
export const ShippingRateSchema = SchemaFactory.createForClass(ShippingRate);

export type ShippingZoneDocument = HydratedDocument<ShippingZone>;

@Schema(baseSchemaOptions)
export class ShippingZone {
  @Prop({ required: true, trim: true })
  name!: string;

  // ISO 3166-1 alpha-2 country codes this zone covers.
  @Prop({ type: [String], required: true })
  countryCodes!: string[];

  @Prop({ type: [ShippingRateSchema], default: [] })
  rates!: ShippingRate[];

  @Prop({ default: true })
  isActive!: boolean;
}

export const ShippingZoneSchema = SchemaFactory.createForClass(ShippingZone);
