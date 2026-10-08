"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/admin";
import { fetchShopActivityLogs, type AdminActivityLog } from "@/lib/admin/shopClaimsClient";
import { formatJaDateTime } from "@/lib/utils/date";

/** 店舗の操作ログ（運営向け）。メンバーの参加・権限の変更・招待・QR の発行と解除などの履歴。新しい順で、続きは「もっと見る」 */
export default function ShopActivityModal({ shop, onClose }: { shop: { vendorId: string; shopName: string } | null; onClose: () => void }) {
  const [logs, setLogs] = useState<AdminActivityLog[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const vendorId = shop?.vendorId;

  const load = useCallback(
    async (before?: string) => {
      if (!vendorId) return;
      try {
        const page = await fetchShopActivityLogs(vendorId, before);
        setLogs((prev) => (before && prev ? [...prev, ...page.logs] : page.logs));
        setHasMore(page.hasMore);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作ログを読み込めませんでした");
      }
    },
    [vendorId],
  );

  useEffect(() => {
    setLogs(null);
    setHasMore(false);
    setError(null);
    void load();
  }, [load]);

  const handleMore = async () => {
    const last = logs?.[logs.length - 1];
    if (!last) return;
    setLoadingMore(true);
    await load(last.createdAt);
    setLoadingMore(false);
  };

  return (
    <Modal open={shop !== null} onClose={onClose} title={`${shop?.shopName ?? ""}の操作ログ`} widthClassName="max-w-xl">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {logs && logs.length === 0 && <p className="py-6 text-center text-sm text-nicchyo-ink/55">まだ記録はありません</p>}
      {logs && logs.length > 0 && (
        <ul className="divide-y divide-line">
          {logs.map((log) => (
            <li key={log.id} className="py-2.5">
              <p className="text-sm text-nicchyo-ink">{log.summary}</p>
              <p className="mt-0.5 text-xs text-nicchyo-ink/55">
                {formatJaDateTime(log.createdAt)} ・ {log.actorName}
              </p>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div className="pt-3 text-center">
          <button type="button" onClick={handleMore} disabled={loadingMore} className="rounded-lg px-4 py-2 text-sm text-nicchyo-ink/70 ring-1 ring-line hover:bg-nicchyo-base disabled:opacity-50">
            {loadingMore ? "読み込んでいます…" : "もっと見る"}
          </button>
        </div>
      )}
    </Modal>
  );
}
