"use client";

import { useEffect, useState } from "react";
import { CenteredLoading, Surface } from "@/components/ui";
import type { IntentionSeason } from "@/lib/vendor/intention";
import type { IntentionSummary } from "@/lib/vendor/intentionSummary";

type CityIntentionResponse = { season: IntentionSeason | null; summary: IntentionSummary | null };

/** 件数。伏せた場所は「少数のため非表示」と出す（0 件は 0 と出す） */
function countText(count: number | null): string {
  return count === null ? "少数のため非表示" : `${count}店`;
}

/**
 * 出店意向調査の集計（市役所向け）。出店したい場所ごとの件数だけ。店ごとの回答は出ない。
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
        出店者の来季の希望（出店したい場所）
      </h2>
      {state.status === "loading" && <CenteredLoading />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-status-critical-fg">読み込めませんでした</p>
      )}
      {state.status === "ready" && !state.season && (
        <Surface padding="md">
          <p className="text-sm text-nicchyo-ink/70">
            調査の季節がまだありません。運営が受付期間を登録すると、ここに集計が出ます。
          </p>
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
          <ul className="divide-y divide-line">
            {state.summary.chomes.map((cell) => (
              <li key={cell.chome} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-nicchyo-ink">{cell.name}</span>
                <span className="font-bold text-nicchyo-ink">{countText(cell.count)}</span>
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-line">
            {state.summary.places.map((cell) => (
              <li key={cell.placeId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-nicchyo-ink">
                  {cell.storeNumber}番{cell.name ? `（${cell.name}）` : ""}
                </span>
                <span className="font-bold text-nicchyo-ink">{countText(cell.count)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-nicchyo-ink/55">
            件数が{state.summary.minReportable}店未満の場所は伏せています。店ごとの回答は表示されません。
          </p>
        </Surface>
      )}
    </section>
  );
}
