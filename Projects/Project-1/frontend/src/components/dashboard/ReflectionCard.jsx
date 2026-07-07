import { ReflectionIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

// Figma "Reflection Container" (151:455 desktop, 347:5727 tablet, 349:3813
// mobile) — identical across all 3 breakpoints. `reflection` is optional in
// the Mood Logger (Step 3 has no requirement), so an empty value falls back
// to a neutral placeholder — no empty-state spec exists in Figma for this.
export function ReflectionCard({ reflection, tags, className }) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 rounded-2xl border border-blue-100 bg-neutral-0 p-5",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <ReflectionIcon className="size-5.5 text-neutral-600" />
        <p className="text-preset-6 text-neutral-600">Reflection of the day</p>
      </div>
      <p className={cn("min-h-0 flex-1 text-preset-6-regular", reflection ? "text-neutral-900" : "text-neutral-600")}>
        {reflection || "No reflection added."}
      </p>
      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <p key={tag} className="text-preset-6-italic text-neutral-600">
              #{tag}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
