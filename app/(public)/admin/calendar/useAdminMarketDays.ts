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
 *
 * ステータスのボタンは押した瞬間には保存しない（下書きなしで即座に公開されると
 * 誤操作がそのまま来訪者に見えてしまうため）。「保存する」を押すまでは
 * statusDrafts / noteDrafts が確定値（days）と食い違ったままの「下書き」状態になる。
 */
export function useAdminMarketDays({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState<MarketDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, MarketDayStatus>>({});

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
      showToast.success(`${formatEventDate(dateIso)} を公開しました`);
      // 保存できたら下書きは確定値と同じになるので消しておく（確定値側は再取得で追従する）
      setStatusDrafts((prev) => {
        const next = { ...prev };
        delete next[dateIso];
        return next;
      });
      setNoteDrafts((prev) => {
        const next = { ...prev };
        delete next[dateIso];
        return next;
      });
      void fetchDays();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingDate(null);
    }
  };

  /** 確定済み（公開中）のステータス。ボタンを押しただけではここは変わらない */
  const committedStatusFor = (dateIso: string): MarketDayStatus | null => {
    const row = byDate.get(dateIso);
    return row ? normalizeStatus(row.status) : null;
  };

  /** 画面上で選ばれている値。まだ保存していなければ確定済みの値と同じ */
  const draftStatusFor = (dateIso: string): MarketDayStatus | null =>
    statusDrafts[dateIso] ?? committedStatusFor(dateIso);

  const setStatusDraft = (dateIso: string, status: MarketDayStatus) =>
    setStatusDrafts((prev) => ({ ...prev, [dateIso]: status }));

  const noteFor = (dateIso: string): string =>
    noteDrafts[dateIso] ?? byDate.get(dateIso)?.note ?? "";

  const setNoteDraft = (dateIso: string, note: string) =>
    setNoteDrafts((prev) => ({ ...prev, [dateIso]: note }));

  const isDirty = (dateIso: string): boolean =>
    draftStatusFor(dateIso) !== committedStatusFor(dateIso) ||
    noteFor(dateIso) !== (byDate.get(dateIso)?.note ?? "");

  return {
    loading,
    savingDate,
    recentNotes,
    committedStatusFor,
    draftStatusFor,
    setStatusDraft,
    noteFor,
    setNoteDraft,
    isDirty,
    save,
  };
}
