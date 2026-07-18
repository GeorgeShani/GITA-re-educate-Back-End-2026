import { motion } from "framer-motion";
import { CheckIcon, XIcon } from "./icons";

export type OptionState = "idle" | "pending" | "correct" | "wrong" | "dim";

interface OptionButtonProps {
  letter: string;
  label: string;
  state: OptionState;
  disabled: boolean;
  onClick: () => void;
}

const STATE_CLASSES: Record<OptionState, string> = {
  idle: "border-term-border bg-black/20 hover:border-term-cyan/70 hover:bg-term-cyan/5",
  pending: "border-term-amber/70 bg-term-amber/10 animate-pulse",
  correct: "border-term-green bg-term-green/15 text-term-green border-glow",
  wrong: "border-term-red bg-term-red/15 text-term-red",
  dim: "border-term-border/40 bg-black/10 opacity-50",
};

export function OptionButton({ letter, label, state, disabled, onClick }: OptionButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { x: 4 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={`flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm text-term-text transition-colors disabled:cursor-not-allowed ${STATE_CLASSES[state]}`}
    >
      <span className="mt-0.5 shrink-0 rounded border border-current/40 px-1.5 font-mono text-xs uppercase text-term-muted">
        {letter}
      </span>
      <span className="flex-1">{label}</span>
      {state === "correct" && <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />}
      {state === "wrong" && <XIcon className="mt-0.5 h-4 w-4 shrink-0" />}
    </motion.button>
  );
}
