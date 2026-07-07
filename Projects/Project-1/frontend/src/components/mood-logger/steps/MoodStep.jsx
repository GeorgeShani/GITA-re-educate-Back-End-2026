import { RadioRow } from "@/components/ui/RadioRow";
import { MOODS } from "@/constants/moods";

// Figma node 308:2801. py-3 (12px) confirmed for this step's rows — differs
// from Step 4's py-4, a genuine per-step Figma value, not normalized away.
export function MoodStep({ value, onChange }) {
  return (
    <div className="flex flex-col gap-3">
      {Object.entries(MOODS).map(([key, mood]) => (
        <RadioRow
          key={key}
          name="mood"
          paddingY="py-3"
          checked={value === key}
          onChange={() => onChange(key)}
          icon={<img src={mood.icon} alt="" className="size-6" />}
        >
          {mood.label}
        </RadioRow>
      ))}
    </div>
  );
}
