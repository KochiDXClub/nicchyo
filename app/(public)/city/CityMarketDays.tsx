"use client";

import { useMemo } from "react";
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
  const d = useAdminMarketDays({ enabled: true, endpoint: "/api/city/market-days" });

  const sundays = useMemo(() => {
    const first = getUpcomingSundayIso();
    return Array.from({ length: SUNDAY_COUNT }, (_, weeksAhead) => ({
      dateIso: addDaysToIso(first, weeksAhead * 7),
      weeksAhead,
    }));
  }, []);

  if (d.loading) {
    return <p className="py-12 text-center text-sm text-slate-400">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <section id="status" aria-labelledby="city-status-heading" className="scroll-mt-4 space-y-3">
        <div>
          <h2 id="city-status-heading" className="text-base font-bold text-slate-900">
            開催ステータス
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            「保存する」を押した時点で、マップと近況ページの最上部に表示されます。
            更新の内容は、いつ誰が変えたかを含めて記録されます。
          </p>
        </div>

        {sundays.map(({ dateIso, weeksAhead }) => (
          <div
            key={dateIso}
            className={`rounded-xl border bg-white shadow-sm ${weeksAhead === 0 ? "border-amber-300" : "border-slate-200"}`}
          >
            <div
              className={`flex flex-wrap items-center gap-2 rounded-t-xl px-4 py-2.5 ${weeksAhead === 0 ? "bg-amber-50" : "bg-slate-50"}`}
            >
              <span className="font-semibold text-slate-900">{formatEventDate(dateIso)}</span>
              <span className="text-xs text-slate-400">{getRelativeSundayLabel(weeksAhead)}</span>
              <MarketDayStatusChip status={d.committedStatusFor(dateIso)} />
            </div>
            <div className="px-4 py-3">
              <MarketDayStatusEditorForDate days={d} dateIso={dateIso} />
            </div>
          </div>
        ))}
      </section>

      <section aria-labelledby="city-history-heading" className="space-y-3">
        <h2 id="city-history-heading" className="text-base font-bold text-slate-900">
          更新履歴
        </h2>
        {d.history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400 shadow-sm">
            まだ更新はありません。
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {d.history.map((item, index) => (
                <li key={`${item.at}-${index}`} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {item.marketDate ? formatEventDate(item.marketDate) : "—"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{item.by}</span>
                    <span className="ml-auto text-xs text-slate-400">{formatDateTime(item.at)}</span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {statusLabel(item.from) && statusLabel(item.from) !== statusLabel(item.to)
                      ? `${statusLabel(item.from)} → ${statusLabel(item.to) ?? "—"}`
                      : (statusLabel(item.to) ?? "—")}
                    {item.note ? `　「${item.note}」` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
