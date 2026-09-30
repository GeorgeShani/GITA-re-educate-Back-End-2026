"use client";

import { Check, Lock, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Barcode } from "@/components/brand/barcode";
import { Stamp, stampStyles } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion, useTick } from "@/lib/motion";
import { failedCount, isHeld, SAMPLES, scoreOf } from "./inspection-samples";

type Phase = "arrive" | "scan" | "done";

const ARRIVE_MS = 650;
const PER_CHECK_MS = 520;
const SETTLE_MS = 500;

/**
 * The landing page's proof of the mechanism: a file arrives, is scanned, its checks print one by one, and a verdict is
 * stamped. Two invented files, one that passes and one that fails a rule. It runs once per file and replays on request;
 * it never loops, so nothing keeps moving offscreen. Reduced motion shows the finished inspection at once.
 */
export function InspectionDemo() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("arrive");
  const [printed, setPrinted] = useState(0);

  const sample = SAMPLES[index] ?? SAMPLES[0];
  const checkCount = sample?.checks.length ?? 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` restarts the sequence for the same file on Replay
  useEffect(() => {
    if (reduced) {
      setPhase("done");
      setPrinted(checkCount);
      return;
    }
    setPhase("arrive");
    setPrinted(0);
    const timers: number[] = [
      window.setTimeout(() => setPhase("scan"), ARRIVE_MS),
    ];
    for (let i = 1; i <= checkCount; i += 1) {
      timers.push(
        window.setTimeout(() => setPrinted(i), ARRIVE_MS + PER_CHECK_MS * i),
      );
    }
    timers.push(
      window.setTimeout(
        () => setPhase("done"),
        ARRIVE_MS + PER_CHECK_MS * checkCount + SETTLE_MS,
      ),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [index, run, reduced, checkCount]);

  const rows = useTick(
    0,
    sample?.rows ?? 0,
    phase !== "arrive" || reduced,
    1000,
  );
  const score = scoreOf(sample?.checks ?? []);
  const shownScore = useTick(0, score, phase === "done", 800);
  if (!sample) return null;

  const held = isHeld(sample.checks);
  const failed = failedCount(sample.checks);
  const done = phase === "done";

  return (
    <div className="flex w-full max-w-lg flex-col gap-4 leaf p-4 text-text sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Sample file</legend>
          {SAMPLES.map((option, optionIndex) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={optionIndex === index}
              onClick={() => {
                setIndex(optionIndex);
                setRun((value) => value + 1);
              }}
              className={cn(
                "h-8 whitespace-nowrap rounded-sm border px-2.5 font-mono text-xs transition-colors duration-(--duration-fast)",
                optionIndex === index
                  ? "border-text bg-text text-canvas"
                  : "border-line-strong text-text-muted hover:bg-sunken hover:text-text",
              )}
            >
              {option.file}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          onClick={() => setRun((value) => value + 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm text-text-muted transition-colors hover:bg-sunken hover:text-text"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          Replay
        </button>
      </div>

      <div
        key={`${sample.id}-${run}`}
        className="conveyor relative overflow-hidden rounded-sm border border-line bg-sunken p-4"
      >
        {phase === "scan" ? (
          <div
            aria-hidden
            className="scan-band pointer-events-none absolute inset-0 border-b-2 border-live bg-live/25"
          />
        ) : null}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-md font-medium">
              {sample.file}
            </p>
            <p className="num mt-1 text-sm text-text-muted">
              <span className="font-mono">{rows.toLocaleString("en-US")}</span>{" "}
              rows · {sample.columns} columns · {sample.size}
            </p>
          </div>
          {done ? (
            <span key="verdict" className="stamp-land inline-flex">
              <span
                className={cn(
                  stampStyles({ tone: held ? "hold" : "pass" }),
                  "h-8 px-3 text-sm",
                )}
              >
                {held ? (
                  <X aria-hidden strokeWidth={2.5} />
                ) : (
                  <Check aria-hidden strokeWidth={2.5} />
                )}
                {held ? "Held" : "Passed"}
              </span>
            </span>
          ) : (
            <Stamp tone={phase === "scan" ? "live" : "idle"}>
              {phase === "scan" ? "Inspecting" : "Arrived"}
            </Stamp>
          )}
        </div>
      </div>

      <ol aria-label="Inspection checks" className="flex flex-col">
        {sample.checks.map((check, checkIndex) => {
          const isPrinted = checkIndex < printed;
          return (
            <li
              key={`${sample.id}-${run}-${check.text}`}
              className="flex min-h-10 items-center justify-between gap-3 border-b border-line py-1.5 text-sm last:border-b-0"
            >
              {isPrinted ? (
                <>
                  <span className="print flex min-w-0 items-center gap-2">
                    {check.ok ? (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-pass"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <X
                        aria-hidden
                        className="size-4 shrink-0 text-hold"
                        strokeWidth={2.5}
                      />
                    )}
                    <span className="truncate">
                      <span className="sr-only">
                        {check.ok ? "Passed: " : "Failed: "}
                      </span>
                      {check.text}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "print num shrink-0 font-mono text-xs",
                      check.ok ? "text-text-muted" : "font-semibold text-hold",
                    )}
                  >
                    {check.result}
                  </span>
                </>
              ) : (
                <span aria-hidden className="h-2 w-2/3 rounded-xs bg-line" />
              )}
            </li>
          );
        })}
      </ol>

      <div aria-live="polite" className="flex flex-col gap-3">
        {done ? (
          <div className="conveyor flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm">
              {held
                ? `${failed} ${failed === 1 ? "rule" : "rules"} failed, including an error-level rule.`
                : "Every rule passed."}
            </p>
            <p className="text-sm text-text-muted">
              Score{" "}
              <span className="num font-mono text-lg font-semibold text-text">
                {shownScore}
              </span>
              <span className="font-mono text-xs"> / 100</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {phase === "arrive" ? "File received." : "Checking your rules…"}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5" />
            {sample.access}
          </span>
          <Barcode value={sample.file} className="h-6 w-28 text-text" />
        </div>
      </div>

      <p className="text-xs text-text-subtle">
        Sample file, invented for this page. Your report is built from your own
        file and your own rules.
      </p>
    </div>
  );
}
