// Wipes every collection in the configured database — the "erase
// everything, then reseed" first step. Run with:
//   npm run seed:reset
//
// Deliberately drops the WHOLE database rather than enumerating and
// clearing each of the ~30 collections by hand: a per-collection list
// silently goes stale the next time someone adds a schema, a
// database-level drop can't. Indexes are rebuilt automatically the next
// time each model is used (Mongoose's own `autoIndex`, on by default in
// dev), so nothing further is needed after this.
//
// Requires MONGODB_URI in .env. Refuses to run against anything that
// doesn't look like a local/dev URI unless FORCE_SEED_RESET=1 is set —
// this command has no undo.
import { existsSync } from 'node:fs';

import mongoose from 'mongoose';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

function looksLikeProduction(uri: string): boolean {
  const lower = uri.toLowerCase();
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  const isAtlasDevCluster =
    lower.includes('mongodb+srv://') && /dev|test|local/.test(lower);
  const isLocalHost = localHosts.some((host) => lower.includes(host));
  return !isLocalHost && !isAtlasDevCluster;
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  if (looksLikeProduction(mongoUri) && process.env.FORCE_SEED_RESET !== '1') {
    throw new Error(
      "MONGODB_URI doesn't look like a local/dev database, and this command permanently deletes every " +
        'record with no undo. If this really is the intended target, re-run with FORCE_SEED_RESET=1.',
    );
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const dbName = mongoose.connection.db?.databaseName;
  console.log(`Dropping database "${dbName}"...`);
  await mongoose.connection.db?.dropDatabase();

  console.log('Done. Every collection is gone.');
  await mongoose.disconnect();
}

void main();
