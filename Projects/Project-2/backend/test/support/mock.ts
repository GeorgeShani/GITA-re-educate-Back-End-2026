/**
 * Shapes a partial stub as a full `T` for tests — a real interface (a
 * NestJS provider, an SDK client) is often too wide to stub every member
 * of just to exercise the handful a given test actually calls, and often
 * nested several levels deep (an SDK client's `.models.generateContentStream`,
 * say), which a `Partial<T>` parameter type can't accept either — Partial
 * only widens the top level, so a stub for one nested method still has to
 * satisfy that nested interface's full shape. `as unknown as T` did this
 * before, at every call site, with no signal that the assertion was
 * deliberate rather than a shortcut past a real type error. One named
 * helper instead: still the same assertion under the hood (there's no way
 * around that — a partial, possibly-nested stub genuinely isn't a real
 * `T`), but now it reads as "this is a test double" rather than "trust
 * me", and there's exactly one place to tighten if a stub ever needs to
 * cover more of the real interface.
 */
export function mockOf<T>(shape: Record<string, unknown>): T {
  return shape as unknown as T;
}
