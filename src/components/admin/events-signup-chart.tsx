"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, cn } from "@/lib/ui";
import { ChartCardHeader } from "@/src/components/admin/chart-card-header";
import {
  BrandBarChart,
  type BrandBarChartRow,
} from "@/src/components/ui/charts/brand-bar-chart";
import { propertyChartColor } from "@/src/components/admin/humanize";
import {
  EVENTS_TREND_RANGES,
  type EventsSignupTrend,
  type EventsTrendRange,
} from "@/src/services/admin/events-stats";
import s from "./events-signup-chart.module.css";

export interface EventsSignupChartProps {
  trend: EventsSignupTrend;
  range: EventsTrendRange;
  basePath: string;
  /** Other active query params (month/property/day) to preserve on range change. */
  preserveParams: Record<string, string | undefined>;
}

export function EventsSignupChart({
  trend,
  range,
  basePath,
  preserveParams,
}: EventsSignupChartProps) {
  const router = useRouter();

  const setRange = useCallback(
    (nextRange: EventsTrendRange) => {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(preserveParams)) {
        if (value) queryParams.set(key, value);
      }
      queryParams.set("range", nextRange);
      router.push(`${basePath}?${queryParams.toString()}`);
    },
    [router, basePath, preserveParams],
  );

  const rows: BrandBarChartRow[] = trend.points.map((point) => ({
    label: point.label,
    ...point.counts,
  }));
  const series = trend.series.map((propertySeries) => ({
    key: propertySeries.slug,
    label: propertySeries.name,
    color: propertyChartColor(propertySeries.slug),
  }));

  return (
    <Card padding="loose" elevation="soft">
      <div className="flex flex-col gap-3">
        <div className={s.head}>
          <ChartCardHeader
            eyebrow="Demand"
            title="Signups"
            detail={`${trend.total} confirmed ${
              trend.total === 1 ? "signup" : "signups"
            } in this window`}
          />
          <div className={s.toggle} role="group" aria-label="Time range">
            {EVENTS_TREND_RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  s.toggleButton,
                  option.value === range && s.toggleActive,
                )}
                aria-pressed={option.value === range}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <BrandBarChart data={rows} series={series} height={220} />
      </div>
    </Card>
  );
}
