import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { User } from '../../users/schemas/user.schema';
import { EmailCategory } from './email-message.schema';

export type NotificationPreferenceDocument =
  HydratedDocument<NotificationPreference>;

// One row per user — SCOPE.md B4, surfaced in My Account (S10).
// Transactional/security/ops categories aren't opt-out-able in the mailer
// itself; this only ever gates marketing/opt-in sends.
@Schema(baseSchemaOptions)
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({
    type: [String],
    default: ['transactional', 'security', 'ops', 'marketing', 'opt-in'],
  })
  optedInCategories!: EmailCategory[];
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(
  NotificationPreference,
);
