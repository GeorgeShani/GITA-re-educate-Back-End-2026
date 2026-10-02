/**
 * A tidy upper bound and the gridline values under it, for a count that starts at zero: steps of 1, 2 or 5 times a power
 * of ten, so every tick is a whole number and reads cleanly ("0, 20, 40, 60").
 */
export function axisFor(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(max, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const step = Math.max(
    1,
    (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power,
  );
  const top = Math.max(step * 2, Math.ceil(Math.max(max, 1) / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}

/** The whole days between two `YYYY-MM-DD` dates (or ISO instants), UTC. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to.slice(0, 10)).getTime() -
      new Date(from.slice(0, 10)).getTime()) /
      86_400_000,
  );
}

/** How tall the people chart needs to be for this many people: a row each, plus a little air. The page reserves this much. */
export const ROW_HEIGHT = 34;
export function peopleHeight(rows: number): number {
  return rows * ROW_HEIGHT + 12;
}
