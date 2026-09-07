export type ProcessRole = 'api' | 'worker' | 'all';

/**
 * Which half of the system this process is running.
 *
 * SCOPE.md B3 deploys the same image twice on Railway — one service as the
 * HTTP API, a second with `ROLE=worker` — so "API and consumers scale
 * independently; a stuck image job can't stall HTTP traffic". That only
 * holds if the two processes actually register different things, which is
 * what {@link runsWorkers} gates.
 *
 * Read from `process.env` rather than ConfigService on purpose: a module's
 * `providers` array is evaluated when the `@Module` decorator runs, which is
 * before Nest has built an injector, so ConfigService does not exist yet.
 * `ConfigModule.forRoot` still validates the value through the Joi schema at
 * boot, so a typo is caught there rather than silently degrading to 'all'.
 */
export function getProcessRole(): ProcessRole {
  const role = process.env.ROLE;
  return role === 'api' || role === 'worker' ? role : 'all';
}

/**
 * True when this process should run BullMQ consumers and the outbox relay.
 * An `api` process must not, or every queue job would be consumed twice and
 * two relays would race for the same outbox rows.
 */
export function runsWorkers(): boolean {
  return getProcessRole() !== 'api';
}
