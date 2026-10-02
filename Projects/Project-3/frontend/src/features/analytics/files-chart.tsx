"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDay } from "@/lib/format/time";
import { usePrefersReducedMotion } from "@/lib/motion";
import {
  AXIS_TICK,
  BASELINE,
  GRID,
  readLabel,
  readValue,
  TipBox,
} from "./chart-tip";
import { axisFor } from "./scale";

export interface DayPoint {
  date: string;
  files: number;
}

function FilesTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: unknown;
  label?: unknown;
}) {
  const files = readValue(payload, "files");
  if (!active || files === null) return null;
  return (
    <TipBox
      title={shortDay(readLabel(label))}
      rows={[
        {
          name: files === 1 ? "file uploaded" : "files uploaded",
          value: files.toLocaleString("en-US"),
          swatch: "var(--color-chart-1)",
        },
      ]}
    />
  );
}

/**
 * Files uploaded each day, as columns. One series, so one hue and no legend: the heading names it. Columns are capped at
 * 24px with a rounded top and a square foot on the baseline, the busiest day is the one value labelled, and everything
 * else is in the tooltip and the table under the chart. They grow from the baseline the first time the chart is shown.
 */
export function FilesChart({ data }: { data: DayPoint[] }) {
  const reduced = usePrefersReducedMotion();
  const peak = data.reduce<DayPoint | null>(
    (best, point) => (point.files > (best?.files ?? 0) ? point : best),
    null,
  );
  const { top, ticks } = axisFor(peak?.files ?? 0);
  return (
    <div className="num h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="12%"
        >
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: BASELINE }}
            minTickGap={28}
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
          <Tooltip
            content={<FilesTip />}
            cursor={{ fill: "var(--color-line)", fillOpacity: 0.5 }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="files"
            fill="var(--color-chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={!reduced}
            animationDuration={700}
            animationEasing="ease-out"
          />
          {peak ? (
            <ReferenceDot
              x={peak.date}
              y={peak.files}
              r={0}
              ifOverflow="visible"
              label={{
                value: peak.files.toLocaleString("en-US"),
                position: "top",
                fill: "var(--color-text)",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
