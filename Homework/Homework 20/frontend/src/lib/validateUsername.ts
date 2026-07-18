// Mirrors backend/src/models/user.model.ts USERNAME_REGEX.

export interface UsernameCheck {
  key: string;
  label: string;
  test: (value: string) => boolean;
}

export const USERNAME_CHECKS: UsernameCheck[] = [
  {
    key: "length",
    label: "1-30 characters",
    test: (v) => v.length > 0 && v.length <= 30,
  },
  {
    key: "charset",
    label: "only letters, numbers, . and _",
    test: (v) => /^[a-zA-Z0-9._]*$/.test(v),
  },
  {
    key: "no-leading-dot",
    label: "can't start with a period",
    test: (v) => !v.startsWith("."),
  },
  {
    key: "no-trailing-dot",
    label: "can't end with a period",
    test: (v) => !v.endsWith("."),
  },
  {
    key: "no-double-dot",
    label: "no consecutive periods",
    test: (v) => !v.includes(".."),
  },
];

export function isValidUsername(value: string): boolean {
  return USERNAME_CHECKS.every((check) => check.test(value));
}
