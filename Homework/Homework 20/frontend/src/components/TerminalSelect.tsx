import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon, CursorBlock } from "./icons";

interface TerminalSelectOption<T extends string> {
  value: T;
  label: string;
}

interface TerminalSelectProps<T extends string> {
  value: T;
  options: readonly TerminalSelectOption<T>[];
  onChange: (value: T) => void;
  /** Short lore prefix shown before the value, rendered like a CLI flag. */
  flag?: string;
  /** Accessible name for the control. */
  ariaLabel?: string;
}

/**
 * A custom dropdown styled as a terminal flag selector: the trigger reads like
 * `--flag value`, and the menu is a small terminal panel with a green `>`
 * pointer + blinking cursor on the active row. Built as a proper listbox
 * (keyboard: up/down/enter/escape, click-outside to close) so it stays as
 * accessible as the native <select> it replaces, but fully on-theme.
 */
export function TerminalSelect<T extends string>({
  value,
  options,
  onChange,
  flag = "sort",
  ariaLabel = flag,
}: TerminalSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  // Which row the keyboard is hovering while open; resets to the selection.
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options[selectedIndex];

  function openMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  // Close when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) openMenu();
        else commit(activeIndex);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative font-mono text-xs">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex items-center gap-2 rounded-md border border-term-border bg-black/30 px-3 py-1.5 text-left transition-colors hover:border-term-green/50 focus:border-term-green/70 focus:outline-none aria-expanded:border-term-green/70"
      >
        <span className="text-term-green">--{flag}</span>
        <span className="text-term-text">{selected?.label}</span>
        <ChevronDownIcon
          className={`h-3 w-3 text-term-muted transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-activedescendant={`${flag}-opt-${activeIndex}`}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute right-0 z-20 mt-1 min-w-full overflow-hidden rounded-md border border-term-green/40 bg-term-panel py-1 shadow-[0_0_24px_-6px_rgba(57,255,20,0.35)]"
          >
            {options.map((option, i) => {
              const isSelected = option.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${flag}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(i)}
                  className={`flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 transition-colors ${
                    isActive
                      ? "bg-term-green/10 text-term-green"
                      : "text-term-text"
                  }`}
                >
                  <span
                    className={`text-term-green ${isActive || isSelected ? "opacity-100" : "opacity-0"}`}
                  >
                    &gt;
                  </span>
                  <span>{option.label}</span>
                  {isActive && <CursorBlock className="text-term-green" />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
