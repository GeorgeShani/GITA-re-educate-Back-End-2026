import { Stamp } from "@/components/ui/stamp";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";
import { SAMPLES, scoreOf } from "../inspection-samples";

/** The company's rules and how one file fared against them. Reuses the hero's inventory sample. */
export function RuleList() {
  const sample = SAMPLES[1];
  if (!sample) return null;
  const score = scoreOf(sample.checks);

  return (
    <Panel label="Rules applied to inventory-q2.csv (sample)">
      <ul className="flex flex-col">
        {sample.checks.map((check, index) => (
          <li
            key={check.text}
            style={stagger(index, 80)}
            className="stagger-item flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm"
          >
            <span className="min-w-0">
              <span className="block truncate">{check.text}</span>
              <span className="text-xs text-text-subtle">
                {check.severity === "error"
                  ? "Error · counts double"
                  : "Warning · counts once"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="num font-mono text-xs text-text-muted">
                {check.result}
              </span>
              <Stamp
                tone={
                  check.ok
                    ? "pass"
                    : check.severity === "error"
                      ? "hold"
                      : "caution"
                }
              >
                {check.ok ? "Pass" : "Fail"}
              </Stamp>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-text-muted">5 of 8 weighted points passed</p>
        <p className="text-sm text-text-muted">
          Score{" "}
          <span className="num font-mono text-xl font-semibold text-text">
            {score}
          </span>
          <span className="font-mono text-xs"> / 100</span>
        </p>
      </div>
    </Panel>
  );
}
