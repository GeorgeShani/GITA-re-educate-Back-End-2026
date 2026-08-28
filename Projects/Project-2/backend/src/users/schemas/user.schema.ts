import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Address, AddressSchema } from '@/common/schemas/address.schema';
import { Role } from '@/common/enums/role.enum';

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

  // Hashes only, never the raw token — same principle as password
  // storage (S5). The raw token is a one-time secret that only ever
  // exists client-side and briefly in the outbox event payload that
  // carries it to the email consumer; a DB leak shouldn't hand out
  // live verify/reset links.
  @Prop({ select: false })
  emailVerificationTokenHash?: string;

  @Prop({ select: false })
  emailVerificationExpiresAt?: Date;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ type: [String], enum: Role, default: [Role.CUSTOMER] })
  roles!: Role[];

  // The address book — SCOPE.md A9 embed rule: no independent lifecycle.
  // Types.DocumentArray, not a plain Address[] — S10 needs
  // addresses.id(addressId) to update/remove a specific one.
  @Prop({ type: [AddressSchema], default: [] })
  addresses!: Types.DocumentArray<Address>;

  @Prop()
  avatarUrl?: string; // Cloudinary secure_url, set once S6 lands

  @Prop({ default: false })
  isDeleted!: boolean; // GDPR account deletion — soft delete, see S10

  // Admin moderation (Phase 6) — distinct from isDeleted: a ban is
  // reversible and doesn't touch the account's PII, unlike deletion's
  // anonymize-and-soft-delete. Checked at login only, not per-request —
  // see BanUserHandler.
  @Prop({ default: false })
  isBanned!: boolean;

  // Created lazily on first saved-payment-method or checkout request
  // that needs one (S10) — most users never save a card, so there's no
  // reason to create a Stripe Customer at registration time.
  @Prop({ select: false })
  stripeCustomerId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
