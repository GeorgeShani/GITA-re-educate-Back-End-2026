import { useEffect, useRef, useState } from "react";

/**
 * Keeps a loading flag `true` for at least `minMs` after it first goes true,
 * so a fast response can't make a loading animation flash by in one frame.
 * Returns the (possibly held-open) loading state.
 */
export function useMinimumLoading(isLoading: boolean, minMs = 1800): boolean {
  const [held, setHeld] = useState(isLoading);
  const startedAt = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      if (startedAt.current === null) startedAt.current = Date.now();
      setHeld(true);
      return;
    }

    // Real loading finished — release only after the minimum has elapsed.
    const elapsed = startedAt.current === null ? minMs : Date.now() - startedAt.current;
    const remaining = Math.max(0, minMs - elapsed);

    const timeout = setTimeout(() => {
      setHeld(false);
      startedAt.current = null;
    }, remaining);

    return () => clearTimeout(timeout);
  }, [isLoading, minMs]);

  return held;
}
