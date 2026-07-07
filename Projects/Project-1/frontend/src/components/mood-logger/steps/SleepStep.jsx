import { RadioRow } from "@/components/ui/RadioRow";
import { SLEEP_OPTIONS } from "@/constants/sleepOptions";

// Figma node 308:3088 — same row pattern as MoodStep but py-4 (16px, a
// genuine per-step difference) and no trailing icon.
export function SleepStep({ value, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      {SLEEP_OPTIONS.map((option) => (
        <RadioRow
          key={option.value}
          name="sleepHours"
          paddingY="py-4"
          checked={value === option.value}
          onChange={() => onChange(option.value)}
        >
          {option.label}
        </RadioRow>
      ))}
    </div>
  );
}
