/** After this many failed attempts a task is parked as `dead` for a human. */
export const MAX_TASK_ATTEMPTS = 5;

const BASE_BACKOFF_MS = 30_000;

/**
 * Exponential backoff: 60s, 120s, 240s, 480s after failures 1–4. `attempts` is
 * the count *including* the attempt that just failed.
 */
export function computeBackoffMs(attempts: number): number {
  return BASE_BACKOFF_MS * 2 ** attempts;
}

export function nextRunAfter(now: Date, attempts: number): Date {
  return new Date(now.getTime() + computeBackoffMs(attempts));
}
