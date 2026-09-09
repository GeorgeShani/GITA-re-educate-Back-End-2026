import { ValueTransformer } from 'typeorm';

/**
 * mysql2 (like most MySQL drivers) returns DECIMAL columns as strings, not
 * numbers, to avoid silently losing precision on values JS's float can't
 * represent exactly. Since we don't need arbitrary precision here, this
 * transformer converts back to a plain JS number on the way out so callers
 * don't have to remember to parse it themselves.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string) => (value === undefined ? value : parseFloat(value)),
};
