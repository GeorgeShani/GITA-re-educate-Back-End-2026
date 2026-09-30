import type { CSSProperties } from "react";

/** Sets CSS custom properties (and any ordinary styles) on an element without type assertions. */
export function cssVars(
  vars: Record<`--${string}`, string>,
  base: CSSProperties = {},
): CSSProperties {
  return Object.assign({}, base, vars);
}

/** The `--i` delay a `.stagger-item` or `.conveyor` reads: item `index`, `step` ms apart. */
export function stagger(index: number, step = 90): CSSProperties {
  return cssVars({ "--i": `${index * step}ms` });
}
