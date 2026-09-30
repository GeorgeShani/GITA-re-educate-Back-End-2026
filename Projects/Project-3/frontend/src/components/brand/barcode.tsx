import { cn } from "@/lib/cn";

interface Bar {
  x: number;
  width: number;
}

/** Bars derived from the characters of `value`: the same string always draws the same label. */
function barsFor(value: string): { bars: Bar[]; length: number } {
  const bars: Bar[] = [];
  let x = 0;
  for (const char of value) {
    const code = char.charCodeAt(0);
    for (let bit = 0; bit < 7; bit += 1) {
      const width = (code >> bit) & 1 ? 2 : 1;
      if (bit % 2 === 0) bars.push({ x, width });
      x += width;
    }
    x += 1;
  }
  return { bars, length: x };
}

/** A label barcode. Decorative: the readable text beside it carries the meaning. */
export function Barcode({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { bars, length } = barsFor(value);
  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox={`0 0 ${length} 24`}
      preserveAspectRatio="none"
      className={cn("h-8 w-40 text-current", className)}
    >
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={0}
          width={bar.width}
          height={24}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
