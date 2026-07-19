import { motion } from "framer-motion";
import type { PublicQuiz } from "../types";
import { CheckIcon } from "./icons";

interface QuizCardProps {
  quiz: PublicQuiz;
  answeredCount: number;
  onPlay: () => void;
}

export function QuizCard({ quiz, answeredCount, onPlay }: QuizCardProps) {
  const total = quiz.questions.length;
  const complete = answeredCount >= total;
  const pct = total === 0 ? 0 : Math.round((answeredCount / total) * 100);

  return (
    <motion.button
      type="button"
      onClick={onPlay}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex h-full w-full flex-col items-start gap-3 rounded-lg border border-term-border bg-term-panel/80 p-4 text-left transition-colors hover:border-term-green/60 hover:shadow-[0_0_24px_-8px_rgba(57,255,20,0.4)]"
    >
      {complete && (
        <div className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-term-green bg-term-panel text-term-green shadow-[0_0_12px_-2px_rgba(57,255,20,0.7)]">
          <CheckIcon className="h-3.5 w-3.5" />
        </div>
      )}

      <span className="max-w-full truncate rounded bg-black/40 px-2 py-0.5 font-mono text-xs text-term-cyan">
        {quiz.filename}
      </span>

      <h3 className="text-base font-semibold text-term-text group-hover:text-glow group-hover:text-term-green">
        {quiz.title}
      </h3>
      <p className="text-xs text-term-muted">{quiz.description}</p>

      <div className="mt-auto w-full">
        <div className="mb-1 flex justify-between text-[11px] text-term-muted">
          <span>progress</span>
          <span>
            {answeredCount}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full bg-term-green transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </motion.button>
  );
}
