import { useEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Cycles "." -> ".." -> "..." -> "." ..., the classic loading-dots effect. */
export function useLoadingDots(intervalMs = 400): string {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      setCount((c) => (c % 3) + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return ".".repeat(prefersReducedMotion() ? 3 : count);
}
