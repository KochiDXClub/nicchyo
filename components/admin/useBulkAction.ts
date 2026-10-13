"use client";

import { useCallback, useState } from "react";
import { showToast } from "@/lib/admin/toast";

interface UseBulkActionOptions {
  /** POST 先（body は { action, ids }）。例: /api/admin/shops/bulk */
  endpoint: string;
  /** 件数の数え方と対象。確認文は「3件の店舗を一括停止しますか？」の形になる */
  unit: string;
  subject: string;
  /** 削除の確認に添える一文（取り消せない操作のとき） */
  deleteWarning?: string;
  /** 成功したあとに一覧を読み直す */
  onDone: () => void | Promise<void>;
}

/**
 * 一覧の「選んだ行をまとめて停止・復活・削除」。確認 → API → 通知 → 読み直しまでを共通にする。
 * 成功したら true を返す（呼び出し側が選択を解除する）。
 */
export function useBulkAction({ endpoint, unit, subject, deleteWarning, onDone }: UseBulkActionOptions) {
  const [bulkLoading, setBulkLoading] = useState(false);

  const runBulk = useCallback(
    async (action: string, ids: readonly string[], label: string): Promise<boolean> => {
      if (ids.length === 0) return false;
      const warning = action === "delete" && deleteWarning ? deleteWarning : "";
      if (!confirm(`${ids.length}${unit}の${subject}を一括${label}しますか？${warning}`)) return false;

      setBulkLoading(true);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok === false) throw new Error(data.error ?? "エラー");
        showToast.success(`${ids.length}${unit}を${label}しました`);
        await onDone();
        return true;
      } catch (err) {
        showToast.error(`一括${label}に失敗しました${err instanceof Error && err.message !== "エラー" ? `: ${err.message}` : ""}`);
        return false;
      } finally {
        setBulkLoading(false);
      }
    },
    [endpoint, unit, subject, deleteWarning, onDone],
  );

  /** 1行だけの操作（同じ API に ids を1件で送る） */
  const runSingle = useCallback(
    async (action: string, id: string, label: string): Promise<boolean> => {
      if (!confirm(`この${subject}を${label}しますか？`)) return false;
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: [id] }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || data.ok === false) throw new Error(data.error ?? "エラー");
        showToast.success(`${label}しました`);
        await onDone();
        return true;
      } catch {
        showToast.error(`${label}に失敗しました`);
        return false;
      }
    },
    [endpoint, subject, onDone],
  );

  return { bulkLoading, runBulk, runSingle };
}
