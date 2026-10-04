"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_TICK,
  readLabel,
  readValue,
  TipBox,
} from "@/features/analytics/chart-tip";
import { usePrefersReducedMotion } from "@/lib/motion";

export interface BarDatum {
  name: string;
  value: number;
}

const ROW = 34;

function Tip({
  active,
  payload,
  label,
  measure,
}: {
  active?: boolean;
  payload?: unknown;
  label?: unknown;
  measure: string;
}) {
  const value = readValue(payload, "value");
  if (!active || value === null) return null;
  return (
    <TipBox
      title={readLabel(label)}
      rows={[
        {
          name: measure,
          value: value.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          swatch: "var(--color-chart-1)",
        },
      ]}
    />
  );
}

/** How tall the chart must be for this many bars. */
export const chartHeight = (bars: number): number => bars * ROW + 12;

/** One measure by one group, as horizontal bars in the product's chart colour: the labels read left to right, however long they are. */
export function ResultChart({
  data,
  measure,
}: {
  data: BarDatum[];
  measure: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className="num w-full"
      style={{ height: chartHeight(data.length) }}
      role="img"
      aria-label={`${measure}, for each of ${data.length} groups. The same numbers are in the table below.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
          barCategoryGap="22%"
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ ...AXIS_TICK, fill: "var(--color-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tickFormatter={(name: string) =>
              name.length > 20 ? `${name.slice(0, 19)}…` : name
            }
          />
          <Tooltip
            content={<Tip measure={measure} />}
            cursor={{ fill: "var(--color-line)", fillOpacity: 0.5 }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            fill="var(--color-chart-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={!reduced}
            animationDuration={700}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="value"
              position="right"
              fill="var(--color-text)"
              fontSize={12}
              fontWeight={600}
              formatter={(value: unknown) =>
                typeof value === "number"
                  ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
                  : ""
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
