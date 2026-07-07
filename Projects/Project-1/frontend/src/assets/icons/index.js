// Icon registry — single import point for every icon used in the app.
//
// Usage: size icons via the --size-icon-* tokens (sm=16px, md=20px, lg=24px),
// e.g. `className="size-4"` (16px) for the default sm icon size. Custom icons
// use `fill="currentColor"` so they inherit the surrounding text color, same
// as lucide-react's default `stroke="currentColor"` behavior.
//
// Custom, brand-specific icons exported from Figma (no clean lucide match):
export { default as SleepIcon } from "./sleep.svg?react";
export { default as ReflectionIcon } from "./reflection.svg?react";
export { default as QuoteIcon } from "./quote.svg?react";
export { default as HintIcon } from "./hint.svg?react";

// Generic UI icons — lucide-react, named to match the Figma icon they represent:
export {
  Check as CheckIcon,
  X as CloseIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUpRight as ArrowRightUpIcon,
  ArrowDownRight as ArrowRightDownIcon,
  ChevronDown as AngleDownIcon,
  LogOut as SignOutIcon,
  Settings as CogIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
} from "lucide-react";
