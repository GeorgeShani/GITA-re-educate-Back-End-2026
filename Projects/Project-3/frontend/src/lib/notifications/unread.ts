import { useSyncExternalStore } from "react";

/**
 * The inbox count in the top bar. The server draws the first number; after that this holds it, so something that happens
 * on the page (a notification arriving live, one being read) changes the bell without drawing the whole frame again.
 */
let count = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Replace the count, for example with the number the server just drew. */
export function setUnread(next: number): void {
  const clean = Math.max(0, Math.floor(next));
  if (clean === count) return;
  count = clean;
  emit();
}

/** Move the count by `change`, never below zero. */
export function adjustUnread(change: number): void {
  setUnread(count + change);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The count, as a React value. `fallback` is what the server drew, so the first paint matches it. */
export function useUnread(fallback: number): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => fallback,
  );
}
