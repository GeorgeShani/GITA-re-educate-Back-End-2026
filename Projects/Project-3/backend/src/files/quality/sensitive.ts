import { isIP } from 'node:net';
import { z } from 'zod';

/**
 * Personal or secret data a spreadsheet may carry. Found by patterns and checksums, never by a model, and only the KIND and
 * how much of a column it covers are kept: no value is ever stored or sent anywhere.
 */
export const SENSITIVE_KINDS = ['email', 'phone', 'card_number', 'iban', 'ip_address', 'secret', 'birth_date'] as const;
export type SensitiveKind = (typeof SENSITIVE_KINDS)[number];

/** What a column of this kind is, in words. */
export const SENSITIVE_LABELS: Record<SensitiveKind, string> = {
  email: 'email addresses',
  phone: 'phone numbers',
  card_number: 'payment card numbers',
  iban: 'bank account numbers (IBAN)',
  ip_address: 'IP addresses',
  secret: 'secrets (keys or tokens)',
  birth_date: 'dates of birth',
};

export const sensitiveSchema = z.object({
  kind: z.enum(SENSITIVE_KINDS),
  /** Share of the column's checked, non-empty values that look like this, 0–100. */
  matchPercent: z.number(),
});
export type Sensitive = z.infer<typeof sensitiveSchema>;

/** Only this many non-empty values per column are looked at: enough to know what a column is, and a hard bound on the cost. */
export const SENSITIVE_SAMPLE = 2000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PHONE = /^\+\d[\d\s().-]{7,18}\d$/;
const PHONE_LOOSE = /^[\d\s().+-]+$/;
const SECRET_PREFIX = /^(sk_(live|test)_|rk_(live|test)_|pk_live_|AKIA[0-9A-Z]{16}$|ASIA[0-9A-Z]{16}$|eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}$|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-|AIza[\w-]{30,}$|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const BIRTH_NAME = /(^|[^a-z])(birth|dob|born)([^a-z]|$)|date_of_birth|birthdate|birthday/i;
const PHONE_NAME = /(phone|mobile|tel(ephone)?|cell)([^a-z]|$)|(^|[^a-z])(gsm|fax)([^a-z]|$)/i;

/** The Luhn checksum every payment card number satisfies. About one random 16-digit number in ten passes it, so it is never enough alone. */
export function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) return false;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** The IBAN checksum (ISO 7064 mod 97-10): move four characters to the end, letters become 10–35, the remainder must be 1. */
export function ibanValid(compact: string): boolean {
  const moved = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of moved) {
    const code = char.charCodeAt(0);
    const value = code >= 65 && code <= 90 ? String(code - 55) : char;
    for (const digit of value) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/**
 * What one cell looks like, apart from where it sits. `columnName` only matters for a phone number written without a
 * country code, which would otherwise be any short number.
 */
export function detectCell(raw: string, columnName = ''): Exclude<SensitiveKind, 'birth_date'> | null {
  const value = raw.trim();
  if (value.length < 5 || value.length > 600) return null;

  if (value.includes('@')) return EMAIL.test(value) ? 'email' : null;
  if (SECRET_PREFIX.test(value)) return 'secret';

  const stripped = value.replace(/[ -]/g, '');
  if (/^\d{13,19}$/.test(stripped) && luhn(stripped)) return 'card_number';

  const compact = value.replace(/\s/g, '').toUpperCase();
  if (IBAN.test(compact) && ibanValid(compact)) return 'iban';

  if (value.length <= 45 && isIP(value) !== 0) return 'ip_address';

  if (PHONE.test(value)) {
    const digits = value.replace(/\D/g, '').length;
    if (digits >= 8 && digits <= 15) return 'phone';
  }
  if (PHONE_NAME.test(columnName) && PHONE_LOOSE.test(value)) {
    const digits = value.replace(/\D/g, '').length;
    if (digits >= 7 && digits <= 15) return 'phone';
  }
  return null;
}

/** A column name that says it holds birth dates: the only way to tell them from any other date. */
export function isBirthDateName(columnName: string): boolean {
  return BIRTH_NAME.test(columnName);
}

/**
 * How much of a column must look like a kind before the column is called that. Specific patterns (a secret's prefix, a
 * checksummed IBAN) need only a few matches; a card number, which a random ID can imitate, needs most of the column.
 */
const THRESHOLD: Record<Exclude<SensitiveKind, 'birth_date'>, number> = {
  email: 0.5,
  phone: 0.5,
  ip_address: 0.5,
  iban: 0.5,
  card_number: 0.6,
  secret: 0.02,
};

/** What a column is, from the counts of what its checked values looked like; null when it is nothing in particular. */
export function classifyColumn(
  hits: Partial<Record<Exclude<SensitiveKind, 'birth_date'>, number>>,
  sampled: number,
): Sensitive | null {
  if (sampled === 0) return null;
  let best: { kind: Exclude<SensitiveKind, 'birth_date'>; share: number } | null = null;
  for (const [kind, count] of Object.entries(hits)) {
    if (!isDetectedKind(kind) || !count) continue;
    const share = count / sampled;
    if (share >= THRESHOLD[kind] && (best === null || share > best.share)) best = { kind, share };
  }
  return best === null ? null : { kind: best.kind, matchPercent: Math.round(best.share * 10_000) / 100 };
}

function isDetectedKind(value: string): value is Exclude<SensitiveKind, 'birth_date'> {
  return value in THRESHOLD;
}
