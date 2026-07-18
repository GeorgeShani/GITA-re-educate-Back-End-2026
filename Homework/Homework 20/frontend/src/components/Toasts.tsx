import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSessionStore } from "../store/sessionStore";
import type { SocketErrorEvent } from "../store/sessionStore";

const AUTO_DISMISS_MS = 4500;

/** Surfaces socket `error` events as transient top-right toasts. */
export function Toasts() {
  const lastError = useSessionStore((s) => s.lastError);
  const [visible, setVisible] = useState<SocketErrorEvent[]>([]);

  useEffect(() => {
    if (!lastError) return;
    setVisible((current) => [...current, lastError]);
    const timeout = setTimeout(() => {
      setVisible((current) => current.filter((e) => e.id !== lastError.id));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [lastError]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {visible.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className="rounded-md border border-term-red/60 bg-term-panel px-4 py-2.5 text-sm text-term-red shadow-lg"
          >
            ! {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
