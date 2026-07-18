import { motion } from "framer-motion";

interface ResultSummaryProps {
  quizTitle: string;
  correctCount: number;
  totalCount: number;
  pointsEarned: number;
  onBackToLobby: () => void;
}

export function ResultSummary({
  quizTitle,
  correctCount,
  totalCount,
  pointsEarned,
  onBackToLobby,
}: ResultSummaryProps) {
  const pct = Math.round((correctCount / totalCount) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-5 py-4 text-center"
    >
      <p className="text-xs uppercase tracking-widest text-term-muted">
        process exited: {quizTitle}
      </p>

      <div className="text-5xl font-bold text-term-green text-glow">{pct}%</div>

      <p className="text-sm text-term-text">
        {correctCount} / {totalCount} correct
      </p>

      <p className="text-sm text-term-cyan">
        +{pointsEarned} points this run
      </p>

      <button
        type="button"
        onClick={onBackToLobby}
        className="mt-2 rounded border border-term-green/60 px-5 py-2 text-sm text-term-green transition-colors hover:bg-term-green/10"
      >
        cd ../lobby
      </button>
    </motion.div>
  );
}
