import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Gender } from '../enums/gender.enum';

export type UserDocument = HydratedDocument<User>;

@Schema(baseSchemaOptions)
export class User {
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, trim: true })
  phoneNumber!: string;

  @Prop({ required: true, enum: Gender })
  gender!: Gender;

  @Prop({ required: true })
  subscriptionStartDate!: Date;

  @Prop({ required: true })
  subscriptionEndDate!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
