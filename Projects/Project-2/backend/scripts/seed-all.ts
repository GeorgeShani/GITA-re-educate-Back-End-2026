// The one command that takes a database from empty to fully populated —
// erase everything, then reseed every entity in the right dependency
// order. Run with:
//   npm run seed:all
//
// Each step below is its own already-existing script (npm run seed:X),
// run here as a real child process rather than imported and awaited
// in-process — every one of them ends with `process.exit()`, which
// would kill this orchestrator too if they ran in the same process.
// Requires MONGODB_URI, CLOUDINARY_*, and PEXELS_API_KEY in .env — see
// docs/ENV_SECRETS_GUIDE.md. Takes a few minutes: seed:catalog and
// seed:content both make one Pexels + one Cloudinary round trip per
// item, rate-limited to stay under Pexels' free-tier 200/hour cap.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

interface Step {
  name: string;
  script: string;
  /** false = a partial failure here (e.g. one bad Pexels lookup) shouldn't stop the run; true = must fully succeed. */
  required: boolean;
}

const STEPS: Step[] = [
  { name: 'Reset database', script: 'scripts/seed-reset.ts', required: true },
  { name: 'Users', script: 'scripts/seed-users.ts', required: true },
  {
    name: 'Catalog (categories + products)',
    script: 'scripts/seed-catalog.ts',
    required: false,
  },
  {
    name: 'Commerce (shipping, tax, coupons, gift cards)',
    script: 'scripts/seed-commerce.ts',
    required: true,
  },
  {
    name: 'Content (blog + pages)',
    script: 'scripts/seed-content.ts',
    required: false,
  },
  { name: 'Orders', script: 'scripts/seed-orders.ts', required: false },
  { name: 'Reviews', script: 'scripts/seed-reviews.ts', required: false },
];

function runStep(step: Step): boolean {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${step.name}`);
  console.log('='.repeat(60));

  try {
    execFileSync(
      'npx',
      ['ts-node', '-r', 'tsconfig-paths/register', step.script],
      {
        stdio: 'inherit',
        env: process.env,
      },
    );
    return true;
  } catch {
    console.error(`\n"${step.name}" exited with a failure.`);
    return false;
  }
}

function main(): void {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  const failedRequired: string[] = [];
  const failedOptional: string[] = [];

  for (const step of STEPS) {
    const ok = runStep(step);
    if (!ok) {
      if (step.required) {
        failedRequired.push(step.name);
        break; // a required step's failure invalidates everything after it
      }
      failedOptional.push(step.name);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failedRequired.length > 0) {
    console.error(
      `Stopped early — required step(s) failed: ${failedRequired.join(', ')}`,
    );
    process.exit(1);
  }
  if (failedOptional.length > 0) {
    console.warn(
      `Done, with partial failures in: ${failedOptional.join(', ')}. Check the output above.`,
    );
    process.exit(1);
  }
  console.log('Done. Database fully reseeded.');
  console.log('='.repeat(60));
}

main();
