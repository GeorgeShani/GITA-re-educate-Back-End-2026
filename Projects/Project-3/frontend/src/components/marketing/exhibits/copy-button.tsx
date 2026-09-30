"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies `text`, and confirms it with a tick that lands and then settles back. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? (
        <span
          key="copied"
          className="stamp-land inline-flex items-center gap-1.5 text-pass"
        >
          <Check aria-hidden strokeWidth={2.5} />
          Copied
        </span>
      ) : (
        <>
          <Copy aria-hidden />
          Copy
        </>
      )}
    </Button>
  );
}
