import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "../store/sessionStore";
import type { SocketErrorEvent } from "../store/sessionStore";

const AUTO_DISMISS_MS = 4500;

type Toast = SocketErrorEvent & { kind: "error" | "kicked" };

/** Surfaces socket `error` and forced-signout events as top-right toasts. */
export function Toasts() {
  const lastError = useSessionStore((s) => s.lastError);
  const kickedMessage = useSessionStore((s) => s.kickedMessage);
  const [visible, setVisible] = useState<Toast[]>([]);

  useEffect(() => {
    if (!lastError) return;
    const toast: Toast = { ...lastError, kind: "error" };
    setVisible((current) => [...current, toast]);
    const timeout = setTimeout(() => {
      setVisible((current) => current.filter((e) => e.id !== toast.id));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [lastError]);

  useEffect(() => {
    if (!kickedMessage) return;
    const toast: Toast = { ...kickedMessage, kind: "kicked" };
    setVisible((current) => [...current, toast]);
    const timeout = setTimeout(() => {
      setVisible((current) => current.filter((e) => e.id !== toast.id));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [kickedMessage]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {visible.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`rounded-md border bg-term-panel px-4 py-2.5 text-sm shadow-lg ${
              toast.kind === "kicked"
                ? "border-term-amber/60 text-term-amber"
                : "border-term-red/60 text-term-red"
            }`}
          >
            ! {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
