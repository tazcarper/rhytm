"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Brand-colored stacked bar chart — companion to BrandAreaChart. Used for
 * the dashboard "on the books" outlook where each stack segment is one
 * property. Series colors come from the caller (property identity colors
 * are owned by the admin scope, not the chart primitive).
 */
export interface BrandBarSeries {
  key: string;
  label: string;
  color: string;
}

export type BrandBarChartRow = { label: string } & Record<string, string | number>;

export function BrandBarChart({
  data,
  series,
  height = 220,
}: {
  data: ReadonlyArray<BrandBarChartRow>;
  series: ReadonlyArray<BrandBarSeries>;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data as BrandBarChartRow[]}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="var(--gray)"
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--gray)"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--paper-warm)" }}
            contentStyle={{
              background: "var(--paper)",
              border: "1px solid var(--border-strong)",
              borderRadius: "3px",
              fontSize: "12px",
              color: "var(--olive)",
            }}
            labelStyle={{ color: "var(--gray)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "12px", color: "var(--gray)" }}
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stackId="outlook"
              fill={entry.color}
              // Only the top segment of the stack gets the rounded cap.
              radius={index === series.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
