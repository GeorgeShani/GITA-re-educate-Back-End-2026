import { cn } from "@/utils/cn";

// 4 discrete pre-sized segments per Figma (not a continuous fill bar), so
// each segment cross-fades color rather than animating width.
export function ProgressSegments({ total, current }) {
  return (
    <div className="flex w-full items-start gap-4">
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors duration-225",
            index < current ? "bg-blue-600" : "bg-blue-200",
          )}
        />
      ))}
    </div>
  );
}
