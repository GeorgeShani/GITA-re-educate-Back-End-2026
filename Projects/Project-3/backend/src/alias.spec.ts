import { describe, expect, it } from 'vitest';
import { SystemClock as ViaAlias } from '#/core/clock/clock.js';
import { FakeClock } from '#test/support/fake-clock.js';
import { SystemClock as ViaRelative } from './core/clock/clock.js';

/**
 * `#/*` (package.json "imports") maps to `src/` under the `gridline-source`
 * condition and to `dist/` by default. Node at runtime uses the default; tsc
 * and Vitest must set the condition. If Vitest ever stops setting it, `#/*`
 * silently falls back to `dist/` — tests then run STALE COMPILED CODE and every
 * class exists twice (one from `src/`, one from `dist/`), which breaks `instanceof`,
 * DI tokens and decorator metadata in ways that look like unrelated bugs.
 *
 * Class identity is the check: the same module reached two ways must be the
 * same object.
 */
describe('#/ subpath imports', () => {
  it('resolve to source, not dist — the same module instance as a relative import', () => {
    expect(ViaAlias).toBe(ViaRelative);
  });

  it('#test/* resolves test support files', () => {
    expect(new FakeClock().now()).toBeInstanceOf(Date);
  });
});
