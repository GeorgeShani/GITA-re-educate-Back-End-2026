/**
 * A query-string boolean. Query strings are text and `Boolean('false')` is `true`, so this is spelled
 * out: use it as `@Transform(toBoolean)` before `@IsBoolean()`. Anything else is left for `IsBoolean` to reject.
 */
export const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;
