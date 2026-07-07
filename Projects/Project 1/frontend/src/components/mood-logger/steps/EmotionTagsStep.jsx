import { Tag } from "@/components/ui/Tag";
import { EMOTION_TAGS } from "@/constants/emotionTags";

const MAX_TAGS = 3;

// Figma node 308:2803 — reuses Tag's checkbox variant directly, pixel-perfect
// match. Per explicit user request, the 3-tag limit is enforced by disabling
// the remaining unchecked tags once 3 are selected (a checked tag stays
// toggleable so you can swap it out), rather than the "Step 2 - Error" spec's
// (473:7171) approach of letting you check past 3 and surfacing a max-3 error
// only on Continue.
export function EmotionTagsStep({ value, onChange }) {
  const limitReached = value.length >= MAX_TAGS;

  function toggleTag(tag) {
    if (value.includes(tag)) {
      onChange(value.filter((selected) => selected !== tag));
    } else if (!limitReached) {
      onChange([...value, tag]);
    }
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-3">
      {EMOTION_TAGS.map((tag) => {
        const checked = value.includes(tag);
        return (
          <Tag
            key={tag}
            variant="checkbox"
            checked={checked}
            disabled={!checked && limitReached}
            onChange={() => toggleTag(tag)}
          >
            {tag}
          </Tag>
        );
      })}
    </div>
  );
}
