import { TextArea } from "@/components/ui/TextArea";

// Figma node 308:3053 — optional field, no validation gates Continue here.
export function ReflectionStep({ value, onChange }) {
  return (
    <TextArea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={150}
      placeholder="Today, I felt..."
      className="h-37.5"
    />
  );
}
