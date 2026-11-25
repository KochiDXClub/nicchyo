import { useCallback, useEffect, useState } from "react";
import type { InboxCounts } from "@/app/api/admin/inbox-counts/route";

const EMPTY: InboxCounts = { notifications: 0, reports: 0, inquiries: 0, vendorInquiries: 0 };

const CHANGED_EVENT = "admin:inbox-changed";

/** 変更の回数。変更の後に始まった取得だけを、同時に動いている取得として使い回す */
let changeEpoch = 0;
let inflight: { epoch: number; promise: Promise<InboxCounts | null> } | null = null;

/** 通知を既読にした・通報や問い合わせのステータスを変えたときに呼ぶ。バッジの件数をすぐ取り直させる */
export function notifyInboxChanged(): void {
  changeEpoch += 1;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** 件数を取得する。同じ画面で同時に呼ばれたときは、進行中の1回の取得を共有する（取れなければ null） */
function requestInboxCounts(): Promise<InboxCounts | null> {
  if (inflight && inflight.epoch === changeEpoch) return inflight.promise;
  const epoch = changeEpoch;
  const promise: Promise<InboxCounts | null> = (async () => {
    try {
      const res = await fetch("/api/admin/inbox-counts");
      if (!res.ok) return null;
      const json = (await res.json()) as Partial<InboxCounts>;
      return {
        notifications: json.notifications ?? 0,
        reports: json.reports ?? 0,
        inquiries: json.inquiries ?? 0,
        vendorInquiries: json.vendorInquiries ?? 0,
      };
    } catch {
      return null;
    }
  })().finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { epoch, promise };
  return promise;
}

/**
 * 受信トレイの新着の件数（未読の通知・未対応の通報・未対応の問い合わせ・未対応の出店者からの連絡）。
 * 60秒ごと、と refreshKey（開いているページなど）が変わったときに取り直す。
 * 取れなかったときは前の値のまま（バッジが急に消えたり出たりしない）。
 */
export function useAdminInboxCounts(enabled: boolean, refreshKey?: string | null) {
  const [counts, setCounts] = useState<InboxCounts>(EMPTY);

  const load = useCallback(async () => {
    if (!enabled) return;
    // 取れなかったときは前の値のまま（バッジが急に消えたり出たりしない）
    const next = await requestInboxCounts();
    if (next) setCounts(next);
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

  const total = counts.notifications + counts.reports + counts.inquiries + counts.vendorInquiries;
  return { counts, total, refresh: load };
}
