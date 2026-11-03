"use client";

import { useMemo } from "react";
import { Badge, Surface } from "@/components/ui";
import {
  addDaysToIso,
  formatEventDate,
  getRelativeSundayLabel,
  getStatusPresentation,
  getUpcomingSundayIso,
  normalizeStatus,
} from "@/lib/market/calendar";
import { useAdminMarketDays } from "@/app/(public)/admin/calendar/useAdminMarketDays";
import {
  MarketDayStatusChip,
  MarketDayStatusEditorForDate,
} from "@/app/(public)/admin/calendar/MarketDayStatusEditor";

/** 更新できる日曜の数（今週を含む） */
const SUNDAY_COUNT = 4;

function statusLabel(status: string | null): string | null {
  return status ? getStatusPresentation(normalizeStatus(status)).label : null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 高知市向け：開催ステータスの更新と、更新履歴。
 * 運営の /admin/calendar と同じ部品・同じ保存の作法（選んだだけでは公開されず、
 * 「保存する」で公開）で、読み書きする API だけが /api/city/market-days。
 */
export function CityMarketDays() {
  const d = useAdminMarketDays({ isAdmin: true, endpoint: "/api/city/market-days" });

  const sundays = useMemo(() => {
    const first = getUpcomingSundayIso();
    return Array.from({ length: SUNDAY_COUNT }, (_, weeksAhead) => ({
      dateIso: addDaysToIso(first, weeksAhead * 7),
      weeksAhead,
    }));
  }, []);

  if (d.loading) {
    return <p className="py-12 text-center text-sm text-nicchyo-ink/50">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="city-status-heading" className="space-y-3">
        <div>
          <h2 id="city-status-heading" className="text-base font-bold text-nicchyo-ink">
            開催ステータス
          </h2>
          <p className="mt-1 text-sm text-nicchyo-ink/70">
            「保存する」を押した時点で、マップと近況ページの最上部に表示されます。
            更新の内容は、いつ誰が変えたかを含めて記録されます。
          </p>
        </div>

        {sundays.map(({ dateIso, weeksAhead }) => (
          <Surface key={dateIso} padding="md" elevation={weeksAhead === 0 ? "lifted" : "raised"}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-nicchyo-ink">{formatEventDate(dateIso)}</span>
              <span className="text-xs text-nicchyo-ink/50">{getRelativeSundayLabel(weeksAhead)}</span>
              <MarketDayStatusChip status={d.committedStatusFor(dateIso)} />
            </div>
            <MarketDayStatusEditorForDate days={d} dateIso={dateIso} />
          </Surface>
        ))}
      </section>

      <section aria-labelledby="city-history-heading" className="space-y-3">
        <h2 id="city-history-heading" className="text-base font-bold text-nicchyo-ink">
          更新履歴
        </h2>
        {d.history.length === 0 ? (
          <Surface padding="md">
            <p className="text-sm text-nicchyo-ink/60">まだ更新はありません。</p>
          </Surface>
        ) : (
          <Surface padding="none">
            <ul className="divide-y divide-line">
              {d.history.map((item, index) => (
                <li key={`${item.at}-${index}`} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-nicchyo-ink">
                      {item.marketDate ? formatEventDate(item.marketDate) : "—"}
                    </span>
                    <Badge variant="neutral">{item.by}</Badge>
                    <span className="ml-auto text-xs text-nicchyo-ink/50">{formatDateTime(item.at)}</span>
                  </div>
                  <p className="mt-1 text-nicchyo-ink/70">
                    {statusLabel(item.from) && statusLabel(item.from) !== statusLabel(item.to)
                      ? `${statusLabel(item.from)} → ${statusLabel(item.to) ?? "—"}`
                      : (statusLabel(item.to) ?? "—")}
                    {item.note ? `　「${item.note}」` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </section>
    </div>
  );
}
