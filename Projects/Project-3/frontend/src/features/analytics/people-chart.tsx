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
import { formatBytes } from "@/lib/format/bytes";
import { usePrefersReducedMotion } from "@/lib/motion";
import { AXIS_TICK, readLabel, readValue, TipBox } from "./chart-tip";

export interface PersonRow {
  name: string;
  files: number;
  bytes: number;
}

function PeopleTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: unknown;
  label?: unknown;
}) {
  const files = readValue(payload, "files");
  const bytes = readValue(payload, "bytes");
  if (!active || files === null) return null;
  const rows = [
    {
      name: files === 1 ? "file" : "files",
      value: files.toLocaleString("en-US"),
      swatch: "var(--color-chart-1)",
    },
  ];
  if (bytes !== null) {
    rows.push({
      name: "uploaded",
      value: formatBytes(bytes),
      swatch: "var(--color-chart-1)",
    });
  }
  return <TipBox title={readLabel(label)} rows={rows} />;
}

/**
 * Who uploaded how much, most active first. The measure is files, so every bar is the same blue: the names carry identity,
 * and the number sits at the tip of each bar, where there are few enough bars for that to read as a label and not as noise.
 */
export function PeopleChart({ data }: { data: PersonRow[] }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="num h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
          barCategoryGap="22%"
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tick={{ ...AXIS_TICK, fill: "var(--color-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-line-strong)" }}
            tickFormatter={(name: string) =>
              name.length > 18 ? `${name.slice(0, 17)}…` : name
            }
          />
          <Tooltip
            content={<PeopleTip />}
            cursor={{ fill: "var(--color-line)", fillOpacity: 0.5 }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="files"
            fill="var(--color-chart-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={!reduced}
            animationDuration={700}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="files"
              position="right"
              fill="var(--color-text)"
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
