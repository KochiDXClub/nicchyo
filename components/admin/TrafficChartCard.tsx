"use client";

import { useMemo, useState } from "react";

export type TrafficGranularity = "day" | "week" | "month" | "year";

export type TrafficPoint = {
  key: string;
  label: string;
  value: number;
};

const GRANULARITY_LABELS: Record<TrafficGranularity, string> = {
  day: "日あたり",
  week: "週あたり",
  month: "月あたり",
  year: "年あたり",
};

const CHART_HEIGHT = 180;

type Props = {
  eyebrow: string;
  title: string;
  barClassName: string;
  panelClassName: string;
  dotClassName: string;
  legendLabel: string;
  seriesByGranularity: Record<TrafficGranularity, TrafficPoint[]>;
};

export default function TrafficChartCard({
  eyebrow,
  title,
  barClassName,
  dotClassName,
  legendLabel,
  seriesByGranularity,
}: Props) {
  const [granularity, setGranularity] = useState<TrafficGranularity>("day");
  const points = useMemo(
    () => seriesByGranularity[granularity] ?? [],
    [seriesByGranularity, granularity]
  );
  const max = useMemo(() => Math.max(...points.map((p) => p.value), 1), [points]);

  const yTicks = useMemo(() => {
    const step = Math.ceil(max / 3);
    return [0, step, step * 2, step * 3].filter((v) => v <= max * 1.1 + 1);
  }, [max]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">{title}</h2>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            {(Object.keys(GRANULARITY_LABELS) as TrafficGranularity[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setGranularity(key)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  granularity === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {GRANULARITY_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} />
            {legendLabel}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {/* Y軸 */}
        <div
          className="flex w-8 shrink-0 flex-col-reverse justify-between pb-6 text-right"
          style={{ height: CHART_HEIGHT + 24 }}
        >
          {yTicks.map((tick) => (
            <span key={tick} className="text-[10px] leading-none text-slate-400">
              {tick}
            </span>
          ))}
        </div>

        {/* グラフ本体 */}
        <div className="min-w-0 flex-1">
          <div
            className="flex items-end gap-1 border-b border-slate-200"
            style={{ height: CHART_HEIGHT }}
          >
            {points.map((point) => (
              <div key={point.key} className="flex h-full flex-1 flex-col justify-end">
                {point.value > 0 && (
                  <p className="mb-0.5 text-center text-[10px] font-semibold text-slate-500">
                    {point.value}
                  </p>
                )}
                <div
                  className={`w-full rounded-t ${barClassName}`}
                  style={{
                    height: `${Math.max((point.value / max) * 100, point.value > 0 ? 5 : 0)}%`,
                  }}
                />
              </div>
            ))}
          </div>
          {/* X軸ラベル */}
          <div className="mt-1.5 flex gap-1">
            {points.map((point) => (
              <div
                key={point.key}
                className="flex-1 overflow-hidden text-center text-[10px] text-slate-400"
              >
                {point.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
