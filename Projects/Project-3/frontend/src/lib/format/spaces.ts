/**
 * A cell with its stray spaces made visible: HTML collapses leading, trailing and doubled spaces, so `"  Ada "` and `"Ada"` look
 * identical on a page. Each such space is shown as a middle dot; a single space between words is left alone.
 */
export function visibleSpaces(text: string): string {
  return text
    .replace(/^ +| +$/g, (run) => "·".repeat(run.length))
    .replace(/ {2,}/g, (run) => "·".repeat(run.length));
}
