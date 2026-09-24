import { QueryFailedError } from 'typeorm';

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * True when `error` is a unique-constraint failure. Callers map it to a 409
 * instead of pre-checking with a SELECT — a pre-check races with a concurrent
 * insert, the constraint is the only thing that actually can't.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;

  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === UNIQUE_VIOLATION
  );
}

/**
 * The name of the constraint a unique violation tripped, or `undefined`. Lets a
 * caller tell two unique constraints on one table apart (e.g. "this Google
 * account is taken" vs "this user already has a Google account").
 */
export function uniqueViolationConstraint(error: unknown): string | undefined {
  if (!isUniqueViolation(error) || !(error instanceof QueryFailedError)) return undefined;

  const driverError: unknown = error.driverError;
  return typeof driverError === 'object' &&
    driverError !== null &&
    'constraint' in driverError &&
    typeof driverError.constraint === 'string'
    ? driverError.constraint
    : undefined;
}
