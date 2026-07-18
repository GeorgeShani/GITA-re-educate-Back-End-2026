import { useEffect, useState } from "react";
import { MascotDancer, pickRandomDance } from "./MascotDancer";
import { CursorBlock } from "./icons";
import { getRandomQuote } from "../lib/loadingQuotes";
import { useLoadingDots } from "../hooks/useLoadingDots";

const QUOTE_ROTATE_MS = 1800;

/**
 * The shared loading state: a dancing mascot over a rotating silly quote.
 * Renders centered content only (no card chrome), so it can sit bare in the
 * lobby or inside a TerminalWindow on the quiz screen.
 */
export function LoadingDance() {
  // Stable for this mount so the dance doesn't switch mid-load.
  const [dance] = useState(pickRandomDance);
  const [quote, setQuote] = useState(() => getRandomQuote());
  const dots = useLoadingDots();

  useEffect(() => {
    const interval = setInterval(() => {
      setQuote((current) => getRandomQuote(current));
    }, QUOTE_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  // Quotes already end in "..." as plain text; strip it so the dots can be
  // animated separately instead of sitting there static.
  const quoteBase = quote.replace(/\.+$/, "");

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <MascotDancer dance={dance} className="h-28 w-28" />
      <p className="text-sm text-term-muted">
        <span className="text-term-green">$</span> {quoteBase}
        <span className="inline-block w-[3ch] text-left">{dots}</span>
        <CursorBlock className="ml-1 text-term-green" />
      </p>
    </div>
  );
}
