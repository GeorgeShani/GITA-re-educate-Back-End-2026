/** What a date or a number written by a person becomes, or null when it is not one this code will vouch for. Never guesses. */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function utc(year: number, month: number, day: number): Date | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // 31 February must not become 3 March.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export interface ParsedDate {
  date: Date;
  /** Both readings (day first, month first) were possible and gave different days. */
  ambiguous: boolean;
}

/**
 * ISO forms are read as they are. `D/M/YYYY`, `D.M.YYYY` and `D-M-YYYY` follow `order` when both numbers could be a month, and
 * are read the only way they can be when one cannot. Month names (`4 Mar 2026`, `March 4, 2026`) are unambiguous. A two-digit
 * year is never guessed at. A time of day is kept only when there is one.
 */
export function parseDate(raw: string, order: 'dmy' | 'mdy'): ParsedDate | null {
  const text = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/.exec(text);
  if (iso) {
    const [, y, m, d, hh, mm, ss, zone] = iso;
    const day = utc(Number(y), Number(m), Number(d));
    if (!day) return null;
    if (hh === undefined || (Number(hh) === 0 && Number(mm) === 0 && Number(ss ?? 0) === 0 && (zone === undefined || zone === 'Z'))) {
      return { date: day, ambiguous: false };
    }
    const stamp = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss ?? '00'}${zone ?? 'Z'}`);
    return Number.isNaN(stamp.getTime()) ? null : { date: stamp, ambiguous: false };
  }

  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = Number(numeric[3]);
    const canBeDmy = b <= 12 && a <= 31;
    const canBeMdy = a <= 12 && b <= 31;
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    const [day, month] =
      canBeDmy && canBeMdy ? (order === 'dmy' ? [a, b] : [b, a]) : canBeDmy ? [a, b] : canBeMdy ? [b, a] : [0, 0];
    const date = utc(year, month, day);
    return date ? { date, ambiguous } : null;
  }

  const named =
    /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(text) ?? /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(text);
  if (named) {
    const dayFirst = /^\d/.test(named[1] ?? '');
    const dayText = dayFirst ? named[1] : named[2];
    const monthText = dayFirst ? named[2] : named[1];
    const monthIndex = MONTHS.indexOf((monthText ?? '').slice(0, 3).toLowerCase());
    if (monthIndex < 0) return null;
    const date = utc(Number(named[3]), monthIndex + 1, Number(dayText));
    return date ? { date, ambiguous: false } : null;
  }
  return null;
}

const CURRENCY = /[€$£¥₾₽₹₺₴]|\b(USD|EUR|GBP|GEL|JPY|CHF|CAD|AUD)\b/gi;

/**
 * `1.234,50 €`, `$1,234.50`, `(2 000)` and `-12,5` as numbers, when the decimal mark is the one the recipe says. Anything else
 * (a percentage, a range, two numbers, words) is not a number this will vouch for, and is left alone.
 */
export function parseNumber(raw: string, decimal: '.' | ','): number | null {
  let text = raw.replace(CURRENCY, '').replace(/[\s  ]/g, '');
  if (text === '') return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  const thousands = decimal === '.' ? ',' : '.';
  // Thousands marks only where they belong: groups of three after the first group.
  const groups = new RegExp(`^\\d{1,3}(\\${thousands}\\d{3})+(\\${decimal}\\d+)?$`);
  const plain = new RegExp(`^\\d+(\\${decimal}\\d+)?$`);
  if (!groups.test(text) && !plain.test(text)) return null;
  const normal = text.split(thousands).join('').replace(decimal, '.');
  const value = Number(normal);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
