import { useEffect } from "react";

const LETTERS = ["a", "b", "c", "d"] as const;

/**
 * Binds the a/b/c/d keys to selecting an option by index, and Enter to advance.
 * Disabled while `disabled` is true (e.g. after an answer has been submitted).
 */
export function useKeyboardAnswers(
  optionCount: number,
  onSelect: (index: number) => void,
  onAdvance: (() => void) | null,
  disabled: boolean
) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (!disabled) {
        const index = LETTERS.indexOf(event.key.toLowerCase() as (typeof LETTERS)[number]);
        if (index !== -1 && index < optionCount) {
          onSelect(index);
          return;
        }
      }

      if (disabled && onAdvance && event.key === "Enter") {
        onAdvance();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [optionCount, onSelect, onAdvance, disabled]);
}
