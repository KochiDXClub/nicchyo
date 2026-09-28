import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { formatEventDate, normalizeStatus, type MarketDayStatus } from "@/lib/market/calendar";

export type MarketDayRow = {
  market_date: string;
  status: string;
  note: string | null;
  updated_at: string;
};

/**
 * 開催ステータス（/admin/calendar の一部）の状態一式。
 *
 * 元は /admin/market-days という独立した画面だったが、来訪者向け /calendar が
 * 開催ステータスと予定をすでに1つの日曜カードにまとめているのに合わせ、
 * 管理画面側も useAdminEvents と同じカードに統合した。取得・保存の作法は
 * useAdminEvents に揃えている。
 */
export function useAdminMarketDays({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState<MarketDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

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
    if (!isAdmin) return;
    void fetchDays();
  }, [fetchDays, isAdmin]);

  // 過去に使った一言（重複除去・新しい順）。雨天中止のように同じ文言を
  // 繰り返し使うことが多いため、毎回タイプし直さなくて済むようにする。
  // 選んでもすぐには保存されず、入力欄に入るだけ（保存はステータスボタン任せ）。
  const recentNotes = useMemo(() => {
    const seen = new Set<string>();
    const notes: string[] = [];
    for (const d of days) {
      if (!d.note || seen.has(d.note)) continue;
      seen.add(d.note);
      notes.push(d.note);
      if (notes.length >= 6) break;
    }
    return notes;
  }, [days]);

  const byDate = useMemo(() => new Map(days.map((d) => [d.market_date, d])), [days]);

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

  const statusFor = (dateIso: string): MarketDayStatus | null => {
    const row = byDate.get(dateIso);
    return row ? normalizeStatus(row.status) : null;
  };

  const noteFor = (dateIso: string): string =>
    noteDrafts[dateIso] ?? byDate.get(dateIso)?.note ?? "";

  const setNoteDraft = (dateIso: string, note: string) =>
    setNoteDrafts((prev) => ({ ...prev, [dateIso]: note }));

  return {
    loading,
    savingDate,
    recentNotes,
    statusFor,
    noteFor,
    setNoteDraft,
    save,
  };
}
