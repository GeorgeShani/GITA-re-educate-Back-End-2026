import { useLayoutEffect, useRef, useState } from "react";
import { CursorBlock } from "./icons";

interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  spellCheck?: boolean;
  className?: string;
  cursorClassName?: string;
}

/**
 * A text input with a custom blinking block cursor that tracks the real
 * caret position, matching the terminal aesthetic used throughout the app.
 * The native caret is hidden (`caret-transparent`); the block cursor only
 * renders (and therefore only blinks) while the input is focused.
 *
 * Position is measured off a hidden mirror span rather than assumed from
 * character count, since <input> doesn't inherit font-family by default and
 * a `ch`-based guess can drift from the real rendered width.
 */
export function TerminalInput({
  value,
  onChange,
  placeholder,
  maxLength,
  autoFocus,
  spellCheck,
  className = "",
  cursorClassName = "text-term-green",
}: TerminalInputProps) {
  const [focused, setFocused] = useState(false);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [cursorLeft, setCursorLeft] = useState(0);

  useLayoutEffect(() => {
    if (mirrorRef.current) setCursorLeft(mirrorRef.current.offsetWidth);
  }, [value]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={spellCheck}
        className={`caret-transparent font-mono w-full bg-transparent p-0 text-sm outline-none ${className}`}
      />
      {/* Invisible copy of the typed text, in the exact same font as the
          input, used only to measure its real rendered width. */}
      <span
        ref={mirrorRef}
        aria-hidden="true"
        className="font-mono invisible absolute left-0 top-0 whitespace-pre text-sm"
      >
        {value}
      </span>
      {focused && (
        <span
          className="pointer-events-none absolute top-1/2 -translate-y-1/2"
          style={{ left: `${cursorLeft}px` }}
        >
          <CursorBlock className={cursorClassName} />
        </span>
      )}
    </div>
  );
}
