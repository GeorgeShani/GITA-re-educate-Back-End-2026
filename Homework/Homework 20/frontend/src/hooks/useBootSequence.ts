import { useEffect, useState } from "react";

export interface BootLine {
  text: string;
  typed: string;
  status: "typing" | "ok";
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Tuned so a 4-line, ~106-character boot log types out in ~3.5-4s total:
// (chars * CHAR_DELAY_MS) + (lines * OK_DELAY_MS) + ((lines - 1) * LINE_GAP_MS) + SETTLE_MS.
const CHAR_DELAY_MS = 22;
const OK_DELAY_MS = 200;
const LINE_GAP_MS = 130;
const SETTLE_MS = 350;

/**
 * Types `lines` out one at a time, character by character, each resolving to
 * an "[ OK ]" status once fully typed before the next line begins,
 * simulating a terminal boot log. `complete` flips true a moment after the
 * last line resolves.
 *
 * Every state mutation is deferred inside a cancellable `setTimeout` (nothing
 * runs synchronously in the effect body) so this stays correct under
 * StrictMode's dev-only double-invoke: the first, soon-to-be-cleaned-up
 * effect run never gets the chance to push a line before it's cancelled.
 */
export function useBootSequence(lines: string[]): {
  visible: BootLine[];
  complete: boolean;
} {
  const [visible, setVisible] = useState<BootLine[]>(
    prefersReducedMotion()
      ? lines.map((text) => ({ text, typed: text, status: "ok" }))
      : []
  );
  
  const [complete, setComplete] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    // Reset rather than assume empty: `lines` is a module-level constant, so
    // this effect only ever re-runs (in production) once, on mount. In dev,
    // Fast Refresh re-evaluates the module on every save, handing this effect
    // a new `lines` array reference while React preserves the old `visible`
    // state — without this reset, each save would append another full boot
    // log onto the last one instead of replaying it cleanly.
    setVisible([]);
    setComplete(false);

    function typeChar(lineIndex: number, text: string, charIndex: number) {
      timeoutId = setTimeout(() => {
        if (cancelled) return;

        const typed = text.slice(0, charIndex);
        setVisible((current) =>
          current.map((line, i) => (i === lineIndex ? { ...line, typed } : line))
        );

        if (charIndex < text.length) {
          typeChar(lineIndex, text, charIndex + 1);
          return;
        }

        timeoutId = setTimeout(() => {
          if (cancelled) return;
          
          setVisible((current) =>
            current.map((line, i) => (i === lineIndex ? { ...line, status: "ok" } : line))
          );
          
          timeoutId = setTimeout(() => {
            if (!cancelled) typeLine(lineIndex + 1);
          }, LINE_GAP_MS);
        }, OK_DELAY_MS);
      }, CHAR_DELAY_MS);
    }

    function typeLine(lineIndex: number) {
      if (lineIndex >= lines.length) {
        timeoutId = setTimeout(() => {
          if (!cancelled) setComplete(true);
        }, SETTLE_MS);
        
        return;
      }

      const text = lines[lineIndex]!;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setVisible((current) => [...current, { text, typed: "", status: "typing" }]);
        typeChar(lineIndex, text, 1);
      }, 0);
    }

    typeLine(0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [lines]);

  return { visible, complete };
}
