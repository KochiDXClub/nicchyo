"use client";

import { useMemo, useState } from "react";
import { INK, SERIES, SURFACE } from "./chart";
import { TableView } from "./components/ui";

export type VisitorPoint = {
  key: string;
  label: string;
  value: number;
  /** 日曜市の開催日（日次表示のときだけ意味がある） */
  isMarketDay?: boolean;
  /** まだ期間が終わっていない区切り（今週・今月・今年・今日） */
  isPartial?: boolean;
};

type Mode = "daily" | "weekly" | "monthly" | "yearly";

type Props = {
  dailyChart: VisitorPoint[];
  weeklyChart: VisitorPoint[];
  monthlyChart: VisitorPoint[];
  yearlyChart: VisitorPoint[];
};

const MODES: { key: Mode; label: string }[] = [
  { key: "daily", label: "日次" },
  { key: "weekly", label: "週次" },
  { key: "monthly", label: "月次" },
  { key: "yearly", label: "年次" },
];

/**
 * 来訪者数の推移。
 *
 * 縦棒を横に並べる形をやめて、横棒を縦に積む形にしている。
 * 縦棒だと画面幅に合わせて図ごと縮むため、スマートフォンでは目盛りも値も
 * 読めない大きさになっていた。横棒なら文字が縮まないので、
 * すべての行に実数をそのまま出せる。
 *
 * 日次では日曜（日曜市の開催日）だけを濃く塗る。平日と混ぜて同じ色にすると、
 * 週に一度の山が「変動が大きいデータ」に見えてしまう。
 */
export default function VisitorTrendSwitcher({
  dailyChart,
  weeklyChart,
  monthlyChart,
  yearlyChart,
}: Props) {
  const [mode, setMode] = useState<Mode>("daily");

  const selected = useMemo(() => {
    if (mode === "weekly") {
      return { caption: "直近12週間（週ごとの合計）", data: weeklyChart };
    }
    if (mode === "monthly") {
      return { caption: "直近12か月（月ごとの合計）", data: monthlyChart };
    }
    if (mode === "yearly") {
      return { caption: "直近5年（年ごとの合計）", data: yearlyChart };
    }
    return { caption: "直近14日間", data: dailyChart };
  }, [mode, dailyChart, weeklyChart, monthlyChart, yearlyChart]);

  const data = selected.data;
  const max = data.reduce((m, point) => Math.max(m, point.value), 0);
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const hasMarketDayMix =
    mode === "daily" && data.some((point) => point.isMarketDay) && data.some((point) => !point.isMarketDay);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {MODES.map((item) => {
          const active = item.key === mode;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              aria-pressed={active}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                active
                  ? "border-amber-700 bg-amber-700 text-white"
                  : "border-amber-200 bg-white text-amber-900 hover:bg-amber-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs" style={{ color: INK.muted }}>
        {selected.caption}
      </p>

      {total === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-800">
          この期間の記録がまだありません
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {data.map((point) => {
              const ratio = max > 0 ? point.value / max : 0;
              // 集計途中の区切りは必ず控えめに描く。満了した区切りと同じ濃さで並べると
              // 「急に落ち込んだ」ように読めてしまう。
              const emphasised = !point.isPartial && (!hasMarketDayMix || point.isMarketDay);
              return (
                <li
                  key={point.key}
                  className="grid grid-cols-[5.5rem_1fr_3.4rem] items-center gap-2"
                  title={`${point.label}：${point.value.toLocaleString()} 人${
                    point.isPartial ? "（集計途中）" : ""
                  }`}
                >
                  <span
                    className="whitespace-nowrap text-[11px] font-medium"
                    style={{ color: emphasised ? INK.secondary : INK.muted }}
                  >
                    {point.label}
                    {point.isPartial ? <span className="ml-1 font-normal">途中</span> : null}
                  </span>
                  <span className="block h-3.5 rounded-sm" style={{ backgroundColor: SURFACE.grid }}>
                    <span
                      className="block h-3.5"
                      style={{
                        width: `${Math.max(ratio * 100, point.value > 0 ? 1.5 : 0)}%`,
                        backgroundColor: emphasised ? SERIES.bar : SERIES.muted,
                        borderRadius: "0 4px 4px 0",
                      }}
                    />
                  </span>
                  <span
                    className="text-right text-[11px] tabular-nums"
                    style={{ color: emphasised ? INK.secondary : INK.muted }}
                  >
                    {point.value.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>

          {hasMarketDayMix ? (
            <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <li className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.secondary }}>
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: SERIES.bar }}
                />
                日曜（日曜市の開催日）
              </li>
              <li className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.secondary }}>
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: SERIES.muted }}
                />
                その他の曜日
              </li>
            </ul>
          ) : null}

          <p className="mt-3 text-[11px]" style={{ color: INK.muted }}>
            この期間の合計 {total.toLocaleString()} 人 ／ 最大 {max.toLocaleString()} 人
            {data.some((point) => point.isPartial)
              ? "。「途中」はまだ期間が終わっていないため、他と同じようには比べられません。"
              : ""}
          </p>

          <TableView
            columns={hasMarketDayMix ? ["期間", "来訪者数", "区分"] : ["期間", "来訪者数"]}
            rows={data.map((point) => {
              const label = point.isPartial ? `${point.label}（集計途中）` : point.label;
              return hasMarketDayMix
                ? [label, point.value.toLocaleString(), point.isMarketDay ? "日曜" : "平日"]
                : [label, point.value.toLocaleString()];
            })}
            caption={`${selected.caption}／合計 ${total.toLocaleString()} 人`}
          />
        </>
      )}
    </div>
  );
}
