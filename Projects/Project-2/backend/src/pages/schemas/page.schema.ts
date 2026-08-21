import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type PageDocument = HydratedDocument<Page>;

// SCOPE.md Phase 7 — static page CMS (about, shipping, returns, privacy,
// terms, FAQ). Admin CRUD is out of scope; these are seeded directly.
@Schema(baseSchemaOptions)
export class Page {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ trim: true })
  seoTitle?: string;

  @Prop({ trim: true })
  seoDescription?: string;
}

export const PageSchema = SchemaFactory.createForClass(Page);
