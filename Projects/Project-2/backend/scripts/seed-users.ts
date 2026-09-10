// Distinct-role test accounts — one of each staff role plus a handful of
// customers with real-shaped address books, so every admin area and
// every account/checkout page has something real to test against
// without registering by hand first. Run with:
//   npm run seed:users
//
// Requires MONGODB_URI in .env. Idempotent: upserts by email, so
// re-running after editing seed-data/users.ts just updates the existing
// accounts (their addresses/roles), it never duplicates them or touches
// an existing password hash.
import { existsSync } from 'node:fs';

import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import { UserSchema } from '../src/users/schemas/user.schema';
import { ALL_USER_SEEDS, TEST_PASSWORD } from './seed-data/users';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const SALT_ROUNDS = 10;

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const UserModel = mongoose.model('User', UserSchema);

  // Hashed once, reused for every account — same bcrypt cost
  // (SALT_ROUNDS = 10) auth.service.ts's own registration path uses.
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, SALT_ROUNDS);

  console.log(`\nSeeding ${ALL_USER_SEEDS.length} users...`);
  for (const [index, seed] of ALL_USER_SEEDS.entries()) {
    console.log(`[user ${index + 1}/${ALL_USER_SEEDS.length}] ${seed.email} (${seed.role})`);

    await UserModel.findOneAndUpdate(
      { email: seed.email },
      {
        firstName: seed.firstName,
        lastName: seed.lastName,
        email: seed.email,
        password: passwordHash,
        emailVerified: seed.emailVerified,
        phone: seed.phone,
        roles: [seed.role],
        addresses: seed.addresses,
        isDeleted: false,
        isBanned: false,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).exec();
  }

  console.log(`\nDone. Every account's password is "${TEST_PASSWORD}".`);
  await mongoose.disconnect();
}

void main();
