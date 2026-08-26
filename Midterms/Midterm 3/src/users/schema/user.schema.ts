import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, trim: true })
  fullName!: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({ type: Number, required: true })
  age!: number;

  @Prop({ type: String, required: true, enum: ['m', 'f'] })
  gender!: 'm' | 'f';
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ age: 1 });
UserSchema.index({ age: 1, gender: 1 });
