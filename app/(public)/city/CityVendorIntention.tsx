"use client";

import { useEffect, useState } from "react";
import { CenteredLoading, Surface } from "@/components/ui";
import {
  INTENTION_FREQUENCY_LABELS,
  type IntentionFrequency,
  type IntentionSeason,
} from "@/lib/vendor/intention";
import type { IntentionCell, IntentionSummary } from "@/lib/vendor/intentionSummary";

type CityIntentionResponse = { season: IntentionSeason | null; summary: IntentionSummary | null };

/** 件数。伏せた項目は「少数のため非表示」と出す（0 件は 0 と出す） */
function countText(count: number | null): string {
  return count === null ? "少数のため非表示" : `${count}店`;
}

function CellList<K extends string | number>({
  cells,
  label,
}: {
  cells: IntentionCell<K>[];
  label: (key: K) => string;
}) {
  return (
    <ul className="divide-y divide-line">
      {cells.map((cell) => (
        <li key={String(cell.key)} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="text-nicchyo-ink">{label(cell.key)}</span>
          <span className="font-bold text-nicchyo-ink">{countText(cell.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 出店意向調査の集計（市役所向け）。店舗ごとの回答は出ない。件数だけを見る。
 */
export function CityVendorIntention() {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error" } | ({ status: "ready" } & CityIntentionResponse)
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/city/vendor-intention", { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<CityIntentionResponse>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", ...data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="city-vendor-intention" className="space-y-3">
      <h2 id="city-vendor-intention" className="text-lg font-bold text-nicchyo-ink">
        出店者の来季の希望（出店意向調査）
      </h2>
      {state.status === "loading" && <CenteredLoading />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-status-critical-fg">読み込めませんでした</p>
      )}
      {state.status === "ready" && !state.season && (
        <Surface padding="md">
          <p className="text-sm text-nicchyo-ink/70">調査の季節がまだありません。運営が受付期間を登録すると、ここに集計が出ます。</p>
        </Surface>
      )}
      {state.status === "ready" && state.season && state.summary && (
        <Surface padding="md" className="space-y-4">
          <p className="text-sm text-nicchyo-ink/70">
            {state.season.title}（受付 {state.season.opensOn} 〜 {state.season.closesOn}）
          </p>
          <p className="text-sm font-bold text-nicchyo-ink">
            回答数:{" "}
            {state.summary.respondents === null ? "少数のため非表示" : `${state.summary.respondents}店`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-bold text-nicchyo-ink">区画の数</h3>
              <CellList cells={state.summary.boothCounts} label={(k) => `${k}区画`} />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold text-nicchyo-ink">出店の頻度</h3>
              <CellList
                cells={state.summary.frequencies}
                label={(k) => INTENTION_FREQUENCY_LABELS[k as IntentionFrequency]}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-bold text-nicchyo-ink">出たい月</h3>
            <CellList cells={state.summary.months} label={(k) => `${k}月`} />
          </div>
          <p className="text-xs text-nicchyo-ink/55">
            件数が{state.summary.minReportable}店未満の項目は伏せています。店ごとの回答は表示されません。
          </p>
        </Surface>
      )}
    </section>
  );
}
