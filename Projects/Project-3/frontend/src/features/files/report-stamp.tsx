import { Clock } from "lucide-react";
import { Stamp } from "@/components/ui/stamp";
import type { ReportStatus } from "./types";

/** How a score reads at a glance: the share of weighted rules passed, 0 to 100. */
export function scoreTone(score: number): "pass" | "caution" | "hold" {
  if (score >= 80) return "pass";
  if (score >= 50) return "caution";
  return "hold";
}

/**
 * Where a file's report stands, as one stamp. A finished report with a score shows the score (its colour is the verdict);
 * everything else shows the state. The hi-vis "being checked" stamp is for a report being built right now, and nothing else.
 */
export function ReportStamp({
  status,
  score,
}: {
  status: ReportStatus;
  score: number | null;
}) {
  switch (status) {
    case "queued":
      return (
        <Stamp tone="idle" icon={<Clock aria-hidden />}>
          Queued
        </Stamp>
      );
    case "profiling":
      return <Stamp tone="live">Checking</Stamp>;
    case "failed":
      return <Stamp tone="hold">Failed</Stamp>;
    case "unsupported":
      return <Stamp tone="idle">Not checked</Stamp>;
    case "ready":
      return score === null ? (
        <Stamp tone="pass">Checked</Stamp>
      ) : (
        <Stamp tone={scoreTone(score)}>
          <span className="sr-only">Quality score </span>
          <span className="num font-mono">{score}</span>
        </Stamp>
      );
  }
}
