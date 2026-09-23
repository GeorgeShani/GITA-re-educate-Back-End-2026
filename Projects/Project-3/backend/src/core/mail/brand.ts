/**
 * Literal hex, not tokens: email clients don't support CSS variables. These
 * are approximations of the direction in SCOPE.md's design system (deep azure,
 * ochre accent, blue-tinted neutrals) and are placeholders until the
 * Milestone 2 brand pass produces the real values.
 */
export const BRAND = {
  primary: '#1a5fb4',
  primaryText: '#ffffff',
  accent: '#c58b1f',
  text: '#1c2733',
  textMuted: '#5b6b7b',
  background: '#f3f6fa',
  surface: '#ffffff',
  border: '#dbe3ec',
} as const;
