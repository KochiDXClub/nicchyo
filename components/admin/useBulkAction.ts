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

  /** API を呼ぶ。一部だけ失敗した（ok:false）ときも、成功した分が画面に残らないよう読み直す */
  const post = useCallback(
    async (action: string, ids: readonly string[]): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        const ok = res.ok && data.ok !== false;
        // 207（一部だけ失敗）は、成功した分があるので読み直す。ネットワークや権限の失敗は読み直さない
        if (ok || res.status === 207) await onDone();
        return { ok, error: data.error };
      } catch {
        return { ok: false };
      }
    },
    [endpoint, onDone],
  );

  const runBulk = useCallback(
    async (action: string, ids: readonly string[], label: string): Promise<boolean> => {
      if (ids.length === 0) return false;
      const warning = action === "delete" && deleteWarning ? deleteWarning : "";
      if (!confirm(`${ids.length}${unit}の${subject}を一括${label}しますか？${warning}`)) return false;

      setBulkLoading(true);
      try {
        const result = await post(action, ids);
        if (result.ok) showToast.success(`${ids.length}${unit}を${label}しました`);
        else showToast.error(`一括${label}に失敗しました${result.error ? `: ${result.error}` : ""}`);
        return result.ok;
      } finally {
        setBulkLoading(false);
      }
    },
    [post, unit, subject, deleteWarning],
  );

  /** 1行だけの操作（同じ API に ids を1件で送る） */
  const runSingle = useCallback(
    async (action: string, id: string, label: string): Promise<boolean> => {
      if (!confirm(`この${subject}を${label}しますか？`)) return false;
      const result = await post(action, [id]);
      if (result.ok) showToast.success(`${label}しました`);
      else showToast.error(`${label}に失敗しました`);
      return result.ok;
    },
    [post, subject],
  );

  return { bulkLoading, runBulk, runSingle };
}
