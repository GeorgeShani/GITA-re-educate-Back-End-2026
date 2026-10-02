"use client";

import { type ReactNode, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

/** The same key the first theme library used, so a visitor's saved choice survives the change. */
const KEY = "theme";
const DARK = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

function stored(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia(DARK).matches ? "dark" : "light";
  }
  return theme;
}

/** Puts the theme on <html>: `data-theme` for the tokens and `color-scheme` for scrollbars and form controls. */
function apply(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The visitor's choice (`system` until they make one), what that resolves to right now, and how to change it. */
export function useTheme(): {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (next: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, stored, (): Theme => "system");
  const resolvedTheme = useSyncExternalStore(
    subscribe,
    () => resolve(stored()),
    (): "light" | "dark" => "light",
  );
  const setTheme = (next: Theme) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice lasts until the page closes, which is all that can be asked of it.
    }
    // Colours should change at once, not fade through half-themed states.
    const style = document.createElement("style");
    style.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(style);
    apply(resolve(next));
    for (const listener of listeners) listener();
    window.setTimeout(() => style.remove(), 50);
  };
  return { theme, resolvedTheme, setTheme };
}

/**
 * Keeps the page in step with the system setting while the visitor has not chosen. The first paint is set by the small
 * script in the root layout, so there is no flash; this only follows later changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const query = window.matchMedia(DARK);
    const follow = () => {
      if (stored() === "system") {
        apply(resolve("system"));
        for (const listener of listeners) listener();
      }
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  return children;
}
