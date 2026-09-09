/**
 * Narrows a plain `string` down to one of `allowed`'s literal values, or
 * `undefined` if it isn't one.
 *
 * Every call site this exists for is the same shape: a shared field
 * component (`select-field`, `tab-group`) emits a bare `string` — it's a
 * generic reusable component, it can't know the caller's specific union —
 * and the caller knows, from its own `options`/`tabs` array, that the
 * runtime value can only ever be one of a fixed set of literals. TS has no
 * way to see that connection on its own; a `.includes()` check doesn't
 * narrow the checked value's type by itself. This is the one assertion
 * that connects the two, so every caller gets a real type guard instead of
 * writing `value as SomeUnion` at the point of use.
 */
export function toUnionValue<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** `toUnionValue`, defaulting to `''` — the shape every admin "status filter" signal needs (`Status | ''`, `''` meaning "all"). */
export function toFilterValue<T extends string>(value: string, allowed: readonly T[]): T | '' {
  return toUnionValue(value, allowed) ?? '';
}
