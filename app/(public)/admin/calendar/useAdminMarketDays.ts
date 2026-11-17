import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { formatEventDate, normalizeStatus, type MarketDayStatus } from "@/lib/market/calendar";

export type MarketDayRow = {
  market_date: string;
  status: string;
  note: string | null;
  image_url?: string | null;
  updated_at: string;
};

/** 開催ステータスの更新履歴の1件（高知市向け API だけが返す） */
export type MarketDayHistoryItem = {
  at: string;
  by: string;
  marketDate: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
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
export function useAdminMarketDays({
  enabled,
  endpoint = "/api/admin/market-days",
}: {
  /** 取得してよいか。運営画面は admin、/city は city_official / admin のとき true */
  enabled: boolean;
  /** 読み書きする API。運営は /api/admin/market-days、高知市は /api/city/market-days */
  endpoint?: string;
}) {
  const [days, setDays] = useState<MarketDayRow[]>([]);
  const [history, setHistory] = useState<MarketDayHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, MarketDayStatus>>({});
  /** 画像の下書き。null は「画像を外す」、キーが無ければ確定値のまま */
  const [imageDrafts, setImageDrafts] = useState<Record<string, string | null>>({});
  const [uploadingImageDate, setUploadingImageDate] = useState<string | null>(null);

  const fetchDays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { days: MarketDayRow[]; history?: MarketDayHistoryItem[] };
      setDays(data.days);
      setHistory(data.history ?? []);
    } catch {
      showToast.error("開催ステータスの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!enabled) return;
    void fetchDays();
  }, [fetchDays, enabled]);

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

  /**
   * 日曜の画像をアップロードして下書きにする（公開は保存ボタンまで行わない）。
   * アップロード先は運営の画像API。高知市の画面では使わない（editable を渡さない）。
   */
  const uploadImage = async (dateIso: string, file: File) => {
    setUploadingImageDate(dateIso);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/events/image", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "アップロードに失敗しました");
      const url = data.url;
      setImageDrafts((prev) => ({ ...prev, [dateIso]: url }));
      showToast.success("画像をアップロードしました（保存すると公開されます）");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setUploadingImageDate(null);
    }
  };

  const save = async (
    dateIso: string,
    status: MarketDayStatus,
    note: string,
    /** undefined なら画像は送らず既存のまま（高知市）。null は画像を外す */
    image?: string | null
  ) => {
    setSavingDate(dateIso);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_date: dateIso,
          status,
          note: note || null,
          ...(image !== undefined ? { image_url: image } : {}),
        }),
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
      setImageDrafts((prev) => {
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

  const committedImageFor = (dateIso: string): string | null =>
    byDate.get(dateIso)?.image_url ?? null;

  /** 画面上の画像。下書きがあればそれ、無ければ確定値 */
  const imageFor = (dateIso: string): string | null =>
    dateIso in imageDrafts ? imageDrafts[dateIso] : committedImageFor(dateIso);

  const setImageDraft = (dateIso: string, url: string | null) =>
    setImageDrafts((prev) => ({ ...prev, [dateIso]: url }));

  const isDirty = (dateIso: string): boolean =>
    draftStatusFor(dateIso) !== committedStatusFor(dateIso) ||
    noteFor(dateIso) !== (byDate.get(dateIso)?.note ?? "") ||
    imageFor(dateIso) !== committedImageFor(dateIso);

  return {
    loading,
    history,
    savingDate,
    recentNotes,
    committedStatusFor,
    draftStatusFor,
    setStatusDraft,
    noteFor,
    setNoteDraft,
    imageFor,
    setImageDraft,
    uploadImage,
    uploadingImageDate,
    isDirty,
    save,
  };
}
