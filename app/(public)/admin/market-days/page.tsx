"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import {
  formatEventDate,
  getRelativeSundayLabel,
  getStatusPresentation,
  getUpcomingSundayIso,
  normalizeStatus,
  type MarketDayStatus,
} from "@/lib/market/calendar";

/** 管理画面に並べる日曜の数 */
const SUNDAY_COUNT = 8;

type MarketDayRow = {
  market_date: string;
  status: string;
  note: string | null;
  updated_at: string;
};

const STATUS_OPTIONS: { value: MarketDayStatus; hint: string }[] = [
  { value: "open", hint: "通常どおり開催" },
  { value: "cancelled", hint: "荒天などで中止" },
  { value: "special", hint: "特別開催・拡大開催" },
  { value: "closed", hint: "臨時休市" },
];

const STATUS_BUTTON_CLASS: Record<MarketDayStatus, string> = {
  open: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-rose-300 bg-rose-50 text-rose-800",
  special: "border-amber-300 bg-amber-50 text-amber-800",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminMarketDaysPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();

  const [days, setDays] = useState<MarketDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const fetchDays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/market-days");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { days: MarketDayRow[] };
      setDays(data.days);
    } catch {
      showToast.error("開催ステータスの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissions.isAdmin) return;
    void fetchDays();
  }, [fetchDays, permissions.isAdmin]);

  // 今週の日曜から先の日曜を並べる。未登録の日曜も枠として出し、
  // 「まだ何も決まっていない」状態が一覧で分かるようにする。
  const sundays = useMemo(() => {
    const first = getUpcomingSundayIso();
    const byDate = new Map(days.map((d) => [d.market_date, d]));
    return Array.from({ length: SUNDAY_COUNT }, (_, i) => {
      const dateIso = addDays(first, i * 7);
      return { dateIso, weeksAhead: i, row: byDate.get(dateIso) ?? null };
    });
  }, [days]);

  const save = async (dateIso: string, status: MarketDayStatus, note: string) => {
    setSavingDate(dateIso);
    try {
      const res = await fetch("/api/admin/market-days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_date: dateIso, status, note: note || null }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      showToast.success(`${formatEventDate(dateIso)} を保存しました`);
      void fetchDays();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingDate(null);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="日曜市カレンダー" title="開催ステータス" />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ここで選んだ内容は<strong>下書きなしで即座に公開</strong>され、マップと近況ページの
        最上部に表示されます。通常開催のときはマップにバーを出さず、中止・臨時休市・
        特別開催のときだけ表示されます。
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {sundays.map(({ dateIso, weeksAhead, row }) => {
            const currentStatus = row ? normalizeStatus(row.status) : null;
            const noteDraft = noteDrafts[dateIso] ?? row?.note ?? "";
            const isSaving = savingDate === dateIso;

            return (
              <div
                key={dateIso}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  weeksAhead === 0 ? "border-amber-300" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{formatEventDate(dateIso)}</span>
                  <span className="text-xs text-slate-400">
                    {getRelativeSundayLabel(weeksAhead)}
                  </span>
                  {currentStatus ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      設定済み：{getStatusPresentation(currentStatus).label}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-400">
                      未設定（通常開催として扱われます）
                    </span>
                  )}
                </div>

                {/* ワンタップ切り替え */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STATUS_OPTIONS.map((option) => {
                    const isSelected = currentStatus === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isSaving}
                        onClick={() => void save(dateIso, option.value, noteDraft)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-left transition disabled:opacity-40 ${
                          isSelected
                            ? STATUS_BUTTON_CLASS[option.value]
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="block text-sm font-bold">
                          {getStatusPresentation(option.value).label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-tight opacity-70">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-600">
                    一言（任意・200文字まで）
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={noteDraft}
                      maxLength={200}
                      placeholder="雨天のため中止します／判断は当日朝6時"
                      onChange={(e) =>
                        setNoteDrafts({ ...noteDrafts, [dateIso]: e.target.value })
                      }
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isSaving || !currentStatus}
                      title={!currentStatus ? "先にステータスを選んでください" : undefined}
                      onClick={() => void save(dateIso, currentStatus ?? "open", noteDraft)}
                      className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                    >
                      {isSaving ? "保存中..." : "一言を保存"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
