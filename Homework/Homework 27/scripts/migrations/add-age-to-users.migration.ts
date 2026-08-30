import { runMigration } from './migration-runner';

/**
 * Backfills the `age` field (introduced alongside the gender statistics
 * endpoint) for users created before it existed. Existing users get a random
 * age within a plausible range so the aggregation has data to work with.
 */
const MIN_AGE = 18;
const MAX_AGE = 65;

void runMigration('add-age-to-users', async (connection) => {
  const { matchedCount, modifiedCount } = await connection
    .collection('users')
    .updateMany({ age: { $exists: false } }, [
      {
        $set: {
          age: {
            $floor: {
              $add: [
                MIN_AGE,
                { $multiply: [{ $rand: {} }, MAX_AGE - MIN_AGE] },
              ],
            },
          },
        },
      },
    ]);

  console.log(`Users without age: ${matchedCount}, updated: ${modifiedCount}.`);
});
