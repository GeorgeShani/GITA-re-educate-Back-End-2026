import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type ContactMessageDocument = HydratedDocument<ContactMessage>;

@Schema(baseSchemaOptions)
export class ContactMessage {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ trim: true })
  subject?: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: false })
  isRead!: boolean;
}

export const ContactMessageSchema =
  SchemaFactory.createForClass(ContactMessage);
