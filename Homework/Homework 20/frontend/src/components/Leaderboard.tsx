import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardEntry } from "../types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId: string | undefined;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ entries, currentUserId }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-term-muted">
        <span className="text-term-green">$</span> no scores yet, be the first to answer
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {entries.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <motion.li
              key={entry.userId}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                isMe
                  ? "border-term-green/60 bg-term-green/10 text-term-green"
                  : "border-term-border/70 bg-black/20 text-term-text"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-6 shrink-0 text-term-muted">
                  {MEDALS[entry.rank - 1] ?? `#${entry.rank}`}
                </span>
                <span className="truncate">{entry.username}</span>
                {isMe && <span className="text-xs text-term-muted">(you)</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{entry.score}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
