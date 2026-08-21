import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type TaxRateDocument = HydratedDocument<TaxRate>;

// Top-level — queried by region at checkout quote time, independently
// of any other aggregate (SCOPE.md Phase 4). The resolved rate is frozen
// onto the Order (Order.taxMinor) at that moment; this collection can
// change later without touching past orders.
@Schema(baseSchemaOptions)
export class TaxRate {
  @Prop({ required: true, trim: true, uppercase: true })
  countryCode!: string; // ISO 3166-1 alpha-2

  @Prop({ trim: true })
  region?: string; // state/province, if the country taxes sub-nationally

  // Basis points (1/100 of a percent) — e.g. 825 = 8.25%. Integer, same
  // reasoning as money-as-minor-units (SCOPE.md A9): avoids float drift.
  @Prop({ required: true })
  rateBasisPoints!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export const TaxRateSchema = SchemaFactory.createForClass(TaxRate);

TaxRateSchema.index({ countryCode: 1, region: 1 }, { unique: true });
