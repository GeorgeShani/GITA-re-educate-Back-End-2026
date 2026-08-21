import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type TagDocument = HydratedDocument<Tag>;

@Schema(baseSchemaOptions)
export class Tag {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  name!: string;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
