import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Address, AddressSchema } from '../../common/schemas/address.schema';
import { Role } from '../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema(baseSchemaOptions)
export class User {
  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  // select: false — never comes back on a plain find/findById; a
  // dedicated repository method (findByEmailWithPassword, S5) opts in
  // explicitly. Ported convention from Homework 25/26.
  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ type: [String], enum: Role, default: [Role.CUSTOMER] })
  roles!: Role[];

  // The address book — SCOPE.md A9 embed rule: no independent lifecycle.
  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Address[];

  @Prop()
  avatarUrl?: string; // Cloudinary secure_url, set once S6 lands

  @Prop({ default: false })
  isDeleted!: boolean; // GDPR account deletion — soft delete, see S10
}

export const UserSchema = SchemaFactory.createForClass(User);
