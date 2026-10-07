import { ibanValid } from '#/files/quality/sensitive.js';
import { type Random, pad } from './random.js';

/** The kinds of file the seed uploads; the workbook ones are written with the same writer Clean uses. */
export type SeedFormat = 'csv' | 'xlsx';

/** Who may open the file: everyone in the company, or the uploader, the admin and the named employees (by roster position). */
export interface SeedAccess {
  visibility: 'company' | 'restricted';
  grantedTo?: readonly number[];
}

export const GEORGIAN_FIRST = ['Nino', 'Giorgi', 'Mariam', 'Levan', 'Tamar', 'Davit', 'Salome', 'Irakli', 'Ana', 'Nika', 'Eka', 'Luka', 'Natia', 'Sandro', 'Keti', 'Zurab'] as const;
export const GEORGIAN_LAST = ['Beridze', 'Kapanadze', 'Chkheidze', 'Gelashvili', 'Japaridze', 'Lomidze', 'Khutsishvili', 'Mgaloblishvili', 'Tsereteli', 'Maisuradze', 'Abashidze', 'Gogoladze', 'Jincharadze', 'Kvaratskhelia'] as const;
export const GERMAN_FIRST = ['Anna', 'Lukas', 'Sophie', 'Jonas', 'Lea', 'Felix', 'Mara', 'Tobias', 'Hannah', 'Paul', 'Clara', 'Max', 'Laura', 'Elias'] as const;
export const GERMAN_LAST = ['Keller', 'Brandt', 'Wagner', 'Hartmann', 'Schneider', 'Neumann', 'Vogel', 'Richter', 'Fischer', 'Weber', 'Becker', 'Hoffmann', 'Schulz', 'Koch'] as const;

export function fullName(random: Random, first: readonly string[], last: readonly string[]): string {
  return `${random.pick(first)} ${random.pick(last)}`;
}

/** A person's address on a domain that can never receive mail, so seeded customers are never written to by accident. */
export function exampleEmail(name: string, random: Random, domain: string): string {
  const [first = 'user', ...rest] = name.toLowerCase().split(' ');
  const surname = rest.join('.') || 'x';
  return `${first}.${surname}${random.int(1, 99)}@${domain}`;
}

/** A Georgian mobile number as people write it: `+995 5xx xx xx xx`. */
export function georgianPhone(random: Random): string {
  return `+995 5${random.int(55, 99)} ${pad(random.int(0, 99), 2)} ${pad(random.int(0, 99), 2)} ${pad(random.int(0, 99), 2)}`;
}

export function germanPhone(random: Random): string {
  return `+49 ${random.pick(['151', '160', '170', '171', '175'])} ${pad(random.int(0, 9_999_999), 7)}`;
}

/** The two check digits of an IBAN: 98 minus the remainder, mod 97, of the account with the country and `00` moved to the end. */
function ibanCheckDigits(country: string, bban: string): string {
  const moved = `${bban}${country}00`;
  const digits = [...moved].map((char) => (/[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char)).join('');
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return pad(98 - remainder, 2);
}

/** A well-formed Georgian IBAN (22 characters), valid by its checksum, for a bank code of two letters. */
export function georgianIban(random: Random): string {
  const bban = `${random.pick(['TB', 'BG', 'LB'])}${pad(random.int(0, 9_999_999), 7)}${pad(random.int(0, 999_999_999), 9)}`;
  const iban = `GE${ibanCheckDigits('GE', bban)}${bban}`;
  if (!ibanValid(iban)) throw new Error(`Generated an invalid IBAN: ${iban}`);
  return iban;
}

export function germanIban(random: Random): string {
  const bban = `${pad(random.int(10_000_000, 99_999_999), 8)}${pad(random.int(0, 9_999_999_999), 10)}`;
  const iban = `DE${ibanCheckDigits('DE', bban)}${bban}`;
  if (!ibanValid(iban)) throw new Error(`Generated an invalid IBAN: ${iban}`);
  return iban;
}

/** A birth date for an adult, written ISO, so a column called `date_of_birth` is recognised and nothing else is needed. */
export function adultBirthDate(random: Random): string {
  return `${random.int(1958, 2003)}-${pad(random.int(1, 12), 2)}-${pad(random.int(1, 28), 2)}`;
}
