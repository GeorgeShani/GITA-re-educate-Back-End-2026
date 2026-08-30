import { runMigration } from './migration-runner';

/**
 * Adds the `isActive` flag to every user document that predates the field.
 *
 * Each existing user is given a random `true`/`false` value (the assignment
 * asks for either). A real-world backfill would normally set a deterministic
 * default such as `true`; swap the pipeline stage below for that if needed.
 */
void runMigration('add-isActive-to-users', async (connection) => {
  const { matchedCount, modifiedCount } = await connection
    .collection('users')
    .updateMany({ isActive: { $exists: false } }, [
      { $set: { isActive: { $lt: [{ $rand: {} }, 0.5] } } },
    ]);

  console.log(
    `Users without isActive: ${matchedCount}, updated: ${modifiedCount}.`,
  );
});
