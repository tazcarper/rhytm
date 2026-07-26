"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Brand-colored area chart — the charts path for the dashboard migration.
 * This is exactly what Tremor renders under the hood (recharts), styled with
 * our olive/tan brand tokens instead of Tremor's default blue. Once we adopt
 * Tremor's copy-in chart blocks for real analytics views, they inherit these
 * same brand colors. See DASHBOARD_MIGRATION.md.
 */
export interface BrandAreaChartPoint {
  label: string;
  value: number;
}

export function BrandAreaChart({
  data,
  height = 220,
}: {
  data: ReadonlyArray<BrandAreaChartPoint>;
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data as BrandAreaChartPoint[]}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="brandOliveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--olive)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--olive)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
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
          />
          <YAxis
            stroke="var(--gray)"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "var(--tan-deep)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--paper)",
              border: "1px solid var(--border-strong)",
              borderRadius: "3px",
              fontSize: "12px",
              color: "var(--olive)",
            }}
            labelStyle={{ color: "var(--gray)" }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--olive)"
            strokeWidth={2}
            fill="url(#brandOliveFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
