"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cssVars } from "@/lib/css-vars";

type State = "visible" | "armed" | "in";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay before this element arrives, in ms. */
  delay?: number;
}

/**
 * Content is visible by default. When the block starts below the fold it is armed (hidden, offset), then released as
 * it scrolls into view. A block already on screen, or a visitor who prefers reduced motion, never sees it hidden.
 * Children marked `.fill` or `.stagger-item` animate with it.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("visible");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    setState("armed");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("in");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style = cssVars({ "--reveal-delay": `${delay}ms` });

  return (
    <div ref={ref} data-reveal={state} className={className} style={style}>
      {children}
    </div>
  );
}
