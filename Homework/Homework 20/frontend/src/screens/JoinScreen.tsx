import { useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TerminalWindow } from "../components/TerminalWindow";
import { TerminalInput } from "../components/TerminalInput";
import { useSessionStore } from "../store/sessionStore";
import { useBootSequence } from "../hooks/useBootSequence";
import { USERNAME_CHECKS, isValidUsername } from "../lib/validateUsername";
import { CheckIcon, CircleIcon, CursorBlock } from "../components/icons";
import { Logo } from "../components/Logo";

const BOOT_LINES = [
  "initializing cs-quiz.arena...",
  "mounting /dev/leaderboard...",
  "connecting to socket layer...",
  "awaiting identity...",
];

export function JoinScreen() {
  const join = useSessionStore((s) => s.join);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { visible: bootLines, complete: bootComplete } = useBootSequence(BOOT_LINES);
  const valid = isValidUsername(username);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await join(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <TerminalWindow filename="boot.sh">
          <div className="mb-5 flex flex-col gap-1.5 text-xs text-term-muted">
            {bootLines.map((line, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-term-green">$</span> {line.typed}
                  {line.status === "typing" && (
                    <CursorBlock className="ml-0.5 text-term-green" />
                  )}
                </span>
                {line.status === "ok" && (
                  <span className="shrink-0 text-term-green">[ OK ]</span>
                )}
              </div>
            ))}
          </div>

          <AnimatePresence>
            {bootComplete && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Logo className="mb-1" />
                <p className="mb-5 text-sm text-term-muted">
                  enter a username to join the live leaderboard
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 rounded-md border border-term-border bg-black/30 px-3 py-2 focus-within:border-term-green/70">
                    <span className="text-term-green">~$</span>
                    <TerminalInput
                      autoFocus
                      value={username}
                      onChange={setUsername}
                      placeholder="username"
                      maxLength={30}
                      className="text-term-text placeholder:text-term-muted"
                    />
                  </div>

                  <ul className="flex flex-col gap-1">
                    {USERNAME_CHECKS.map((check) => {
                      const passed = check.test(username);
                      return (
                        <li
                          key={check.key}
                          className={`flex items-center gap-2 text-xs ${
                            passed ? "text-term-green" : "text-term-muted"
                          }`}
                        >
                          {passed ? (
                            <CheckIcon className="h-3 w-3 shrink-0" />
                          ) : (
                            <CircleIcon className="h-3 w-3 shrink-0" />
                          )}
                          <span>{check.label}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {error && <p className="text-sm text-term-red">! {error}</p>}

                  <button
                    type="submit"
                    disabled={!valid || submitting}
                    className="rounded border border-term-green/70 bg-term-green/10 py-2 text-sm text-term-green transition-colors hover:bg-term-green/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submitting ? "connecting..." : "run ./join.sh"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </TerminalWindow>
      </motion.div>
    </div>
  );
}
