import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type NewsletterSubscriberDocument =
  HydratedDocument<NewsletterSubscriber>;

// SCOPE.md B4 — double opt-in: `confirmedAt` stays null until the
// confirmation email link is clicked (S11), so `marketing.newsletter_subscribed`
// only fires once that happens.
@Schema(baseSchemaOptions)
export class NewsletterSubscriber {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: Date, default: null })
  confirmedAt!: Date | null;

  @Prop({ type: Date, default: null })
  unsubscribedAt!: Date | null;
}

export const NewsletterSubscriberSchema =
  SchemaFactory.createForClass(NewsletterSubscriber);
