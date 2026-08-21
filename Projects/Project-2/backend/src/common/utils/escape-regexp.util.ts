// Ported verbatim from Homework 24/26 — escapes regex metacharacters
// before a user-supplied string (search terms, filters) is interpolated
// into a Mongo $regex query, so a query like "3.5"" doesn't act as a
// wildcard and "(" doesn't throw an invalid-regex error.
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
