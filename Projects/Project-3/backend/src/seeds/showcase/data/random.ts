/**
 * A small seeded random generator (mulberry32). The seed data must be the same on every run, so a file uploaded today and the
 * next version of it uploaded tomorrow still line up row for row, and so a test can say what a generator produces.
 */
export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both included. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with the given probability. */
  chance(probability: number): boolean;
  /** A number with two decimals in [min, max]. */
  money(min: number, max: number): number;
}

export function randomFrom(seed: number): Random {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      const item = items[int(0, items.length - 1)];
      if (item === undefined) throw new Error('pick() needs a non-empty list');
      return item;
    },
    chance: (probability) => next() < probability,
    money: (min, max) => Math.round((min + next() * (max - min)) * 100) / 100,
  };
}

const DAY_MS = 86_400_000;

/** Every date in the seed data is counted from this fixed day, never from "now". */
export const BASE_DAY = Date.UTC(2026, 8, 1);

/** `YYYY-MM-DD`, `offsetDays` after (or, negative, before) the base day. */
export function isoDay(offsetDays: number): string {
  return new Date(BASE_DAY + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** The same day written the way a hurried person writes it: `DD/MM/YYYY`. */
export function dmyDay(offsetDays: number): string {
  const [year, month, day] = isoDay(offsetDays).split('-');
  return `${day}/${month}/${year}`;
}

export function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
