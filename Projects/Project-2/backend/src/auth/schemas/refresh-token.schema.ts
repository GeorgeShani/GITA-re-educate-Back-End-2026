import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { User } from '@/users/schemas/user.schema';

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

// Not in SCOPE.md's original ~40-model list — added in S5. The refresh
// token issued to the client is itself a JWT (signed with
// JWT_REFRESH_SECRET, so a forged or expired one is rejected without a
// DB hit), but a stateless JWT alone can't be revoked or rotated —
// that's what this collection is for. `tokenHash` is a SHA-256 of the
// signed JWT string, never the raw token itself.
@Schema(baseSchemaOptions)
export class RefreshToken {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  // Rotation chain: set when this token is exchanged for a new one at
  // refresh time. If a token with a non-null replacedByTokenId (i.e.
  // already rotated away) is presented again, that's a reuse/theft
  // signal — AuthService revokes every active token for the user,
  // forcing a full re-login rather than trying to track finer-grained
  // "token families".
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RefreshToken',
    default: null,
  })
  replacedByTokenId!: Types.ObjectId | null;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL cleanup — a token past its own expiry has nothing left to check
// (an attacker replaying a naturally-expired token would fail JWT
// expiry verification before ever reaching the DB), so there's no
// reuse-detection value in keeping expired rows around.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
