// Mirrors the `--breakpoint-*` tokens in src/index.css — keep in sync.
export const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
};

export const MEDIA_QUERIES = {
  tablet: `(min-width: ${BREAKPOINTS.tablet}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
};
