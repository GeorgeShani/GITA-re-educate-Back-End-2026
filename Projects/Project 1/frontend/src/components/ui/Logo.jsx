import logoIcon from "@/assets/logo-icon.svg";
import { cn } from "@/utils/cn";

// Figma "Logo" component (node 151:1983) — shared between AuthLayout and the
// Navbar (node 361:12208 & responsive equivalents), pixel-identical in both.
export function Logo({ className }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-4", className)}>
      <img src={logoIcon} alt="" className="size-10" />
      <p className="text-[21px] font-bold tracking-[-0.8px] text-neutral-900">Mood tracker</p>
    </div>
  );
}
