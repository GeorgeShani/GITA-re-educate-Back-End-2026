import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type EmailSuppressionDocument = HydratedDocument<EmailSuppression>;

// SCOPE.md B4 — "legally load-bearing, not a nicety." Hard bounces and
// complaints insert here automatically via provider webhook; the mailer
// checks this before every send, no exceptions.
@Schema(baseSchemaOptions)
export class EmailSuppression {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  reason!: 'bounce' | 'complaint' | 'manual';
}

export const EmailSuppressionSchema =
  SchemaFactory.createForClass(EmailSuppression);
