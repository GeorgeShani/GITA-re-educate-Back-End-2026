// Bootstraps the very first admin account. No HTTP route can ever do this:
// registration always assigns [Role.CUSTOMER] (see user.schema.ts), and
// every /admin/* route this phase adds requires an admin to already exist
// to call it. Run with:
//   npm run promote-admin -- <email> [role]
//
// Requires MONGODB_URI in .env — see docs/ENV_SECRETS_GUIDE.md. Idempotent:
// re-running against an already-promoted email is a no-op, not an error.
// [role] defaults to "admin"; pass "manager" | "support" | "editor" to
// grant a narrower staff role instead — see admin-roles.constant.ts for
// what each one can reach.
import { existsSync } from 'node:fs';

import mongoose from 'mongoose';

import { Role } from '../src/common/enums/role.enum';
import { UserSchema } from '../src/users/schemas/user.schema';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main(): Promise<void> {
  const [, , email, roleArg] = process.argv;
  if (!email) {
    console.error('Usage: npm run promote-admin -- <email> [role]');
    process.exit(1);
  }

  const role = (roleArg?.toUpperCase() ?? 'ADMIN') as keyof typeof Role;
  if (!(role in Role)) {
    console.error(
      `Unknown role "${roleArg}" — must be one of: admin, manager, support, editor`,
    );
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const UserModel = mongoose.model('User', UserSchema);

  // Replaces rather than appends — the app's single-active-role decision
  // (RolesGuard/JWT only ever check one role) means a staff account has
  // exactly one working role at a time, not an accumulating set.
  const result = await UserModel.updateOne(
    { email: email.toLowerCase(), isDeleted: false },
    { roles: [Role[role]] },
  ).exec();

  if (result.matchedCount === 0) {
    console.error(
      `No account found for ${email} — they need to register first.`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`${email} is now ${Role[role]}.`);
  await mongoose.disconnect();
}

void main();
