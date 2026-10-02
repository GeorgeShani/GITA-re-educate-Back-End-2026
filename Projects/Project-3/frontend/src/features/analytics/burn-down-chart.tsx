"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { components } from "@/lib/api/schema";
import { shortDay } from "@/lib/format/time";
import { usePrefersReducedMotion } from "@/lib/motion";
import { burnRows } from "./burn-rows";
import {
  AXIS_TICK,
  BASELINE,
  GRID,
  readLabel,
  readValue,
  TipBox,
} from "./chart-tip";
import { axisFor } from "./scale";

type Quota = components["schemas"]["QuotaBurnDownDto"];

function BurnTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: unknown;
  label?: unknown;
}) {
  if (!active) return null;
  const used = readValue(payload, "used");
  const pace = readValue(payload, "pace");
  const rows = [];
  if (used !== null) {
    rows.push({
      name: used === 1 ? "file used" : "files used",
      value: used.toLocaleString("en-US"),
      swatch: "var(--color-chart-1)",
    });
  }
  if (pace !== null) {
    rows.push({
      name: "at an even pace",
      value: pace.toLocaleString("en-US"),
      swatch: "var(--color-line-strong)",
    });
  }
  return rows.length === 0 ? null : (
    <TipBox title={shortDay(readLabel(label))} rows={rows} />
  );
}

/**
 * This period's files against the quota. Two series: the files used so far (the product's blue, with a faint wash under
 * it) and an even pace to the quota (neutral, so it reads as the yardstick, not a competitor). The quota is a hairline
 * with its number; the end of the used line carries a dot and its value. The line draws left to right when first shown.
 */
export function BurnDownChart({ quota }: { quota: Quota }) {
  const reduced = usePrefersReducedMotion();
  const rows = burnRows(quota);
  const last = quota.points.at(-1);
  const { top, ticks } = axisFor(Math.max(quota.limit, quota.used));
  return (
    <div className="num h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 20, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: BASELINE }}
            minTickGap={36}
          />
          <YAxis
            allowDecimals={false}
            domain={[0, top]}
            ticks={ticks}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <ReferenceLine
            y={quota.limit}
            stroke={BASELINE}
            strokeWidth={1}
            label={{
              value: `Quota: ${quota.limit.toLocaleString("en-US")} files`,
              position: "insideTopLeft",
              fill: "var(--color-text-muted)",
              fontSize: 12,
            }}
          />
          <Tooltip
            content={<BurnTip />}
            cursor={{ stroke: BASELINE, strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="pace"
            type="linear"
            stroke="var(--color-line-strong)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--color-line-strong)",
              stroke: "var(--color-surface)",
              strokeWidth: 2,
            }}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            dataKey="used"
            type="linear"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            fill="var(--color-chart-1)"
            fillOpacity={0.1}
            dot={false}
            activeDot={{
              r: 4,
              fill: "var(--color-chart-1)",
              stroke: "var(--color-surface)",
              strokeWidth: 2,
            }}
            connectNulls={false}
            isAnimationActive={!reduced}
            animationDuration={900}
            animationEasing="ease-out"
          />
          {last ? (
            <ReferenceDot
              x={last.date}
              y={last.used}
              r={4}
              fill="var(--color-chart-1)"
              stroke="var(--color-surface)"
              strokeWidth={2}
              ifOverflow="visible"
              label={{
                value: last.used.toLocaleString("en-US"),
                position: "top",
                fill: "var(--color-text)",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
