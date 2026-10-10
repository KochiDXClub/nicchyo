import { useCallback, useEffect, useState } from "react";
import type { InboxCounts } from "@/app/api/admin/inbox-counts/route";

const EMPTY: InboxCounts = { notifications: 0, reports: 0, inquiries: 0 };

const CHANGED_EVENT = "admin:inbox-changed";

/** 通知を既読にした・通報や問い合わせのステータスを変えたときに呼ぶ。バッジの件数をすぐ取り直させる */
export function notifyInboxChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * 受信トレイの新着の件数（未読の通知・未対応の通報・未対応の問い合わせ）。
 * 60秒ごと、と refreshKey（開いているページなど）が変わったときに取り直す。
 * 取れなかったときは前の値のまま（バッジが急に消えたり出たりしない）。
 */
export function useAdminInboxCounts(enabled: boolean, refreshKey?: string | null) {
  const [counts, setCounts] = useState<InboxCounts>(EMPTY);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/admin/inbox-counts");
      if (!res.ok) return;
      const json = (await res.json()) as Partial<InboxCounts>;
      setCounts({
        notifications: json.notifications ?? 0,
        reports: json.reports ?? 0,
        inquiries: json.inquiries ?? 0,
      });
    } catch {
      // 取れなければ前の値のまま
    }
  }, [enabled]);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 60_000);
    window.addEventListener(CHANGED_EVENT, load);
    return () => {
      clearInterval(interval);
      window.removeEventListener(CHANGED_EVENT, load);
    };
    // refreshKey が変わったら取り直す
  }, [load, refreshKey]);

  const total = counts.notifications + counts.reports + counts.inquiries;
  return { counts, total, refresh: load };
}
