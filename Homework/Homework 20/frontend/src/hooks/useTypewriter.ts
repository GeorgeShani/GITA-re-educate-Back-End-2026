import { useEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Reveals `text` one character at a time whenever it changes. */
export function useTypewriter(text: string, speedMs = 18): string {
  const [visible, setVisible] = useState(prefersReducedMotion() ? text : "");

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(text);
      return;
    }

    setVisible("");
    
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisible(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speedMs);

    return () => clearInterval(id);
  }, [text, speedMs]);

  return visible;
}
