type QueryValue = string | number | boolean;

/**
 * Narrows an `[key, value]` entry once its value is known to be defined —
 * lets `Array.prototype.filter` produce a properly-typed array so
 * `Object.fromEntries` below infers `Record<string, QueryValue>` on its
 * own. No cast needed: this is the difference between filtering with an
 * arrow (`([, v]) => v !== undefined)`, which TS can't turn back into a
 * narrower array type, and filtering with a type predicate, which it can.
 */
function hasDefinedValue<K extends string>(
  entry: [K, QueryValue | undefined],
): entry is [K, QueryValue] {
  return entry[1] !== undefined;
}

/**
 * Drops every `undefined`-valued key from a query object, for `ApiClient.get`'s
 * `params` bag — an optional filter field (e.g. `status?: ReviewStatus`) has
 * to reach here as `undefined` when unset, but `HttpParams` renders literal
 * `"undefined"` strings if that's ever left in. Previously duplicated,
 * byte-for-byte, across 14 files under `core/services/`.
 */
export function toHttpParams<Q extends Record<string, QueryValue | undefined>>(
  query: Q,
): Record<string, QueryValue> {
  return Object.fromEntries(Object.entries(query).filter(hasDefinedValue));
}
