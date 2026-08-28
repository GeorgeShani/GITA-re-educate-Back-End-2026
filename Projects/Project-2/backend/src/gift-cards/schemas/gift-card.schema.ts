import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { User } from '../../users/schemas/user.schema';

export type GiftCardDocument = HydratedDocument<GiftCard>;

// Balance-tracked, not a coupon — SCOPE.md B4 "giftcard.issued" email.
// `balanceMinor` is decremented directly at redemption (inside the same
// transaction as the order it pays for, per A9's transactional-write
// rule), not derived from a separate ledger — a gift card's whole point
// is a single authoritative balance.
@Schema(baseSchemaOptions)
export class GiftCard {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ required: true })
  initialBalanceMinor!: number;

  @Prop({ required: true })
  balanceMinor!: number;

  @Prop({ required: true, default: 'usd' })
  currency!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  issuedToUserId?: Types.ObjectId;

  @Prop()
  expiresAt?: Date;

  @Prop({ default: true })
  isActive!: boolean;
}

export const GiftCardSchema = SchemaFactory.createForClass(GiftCard);
