import type { SupabaseClient } from "@supabase/supabase-js";
import { VENDOR_ACTIVITY_LABELS } from "./activityLog";

/** 1 回に返す件数 */
export const ACTIVITY_LOG_PAGE_SIZE = 30;

export type ActivityLogItem = {
  id: number;
  actorName: string;
  action: string;
  label: string;
  summary: string;
  createdAt: string;
};

/**
 * 店舗の操作ログを新しい順に 1 ページ読む。before（日時）を渡すと、それより古い分を返す。
 * 出店者側（audit_view の権限があるメンバー）と、運営の管理画面の両方が使う。呼ぶ側が、見てよい人かを先に確かめること。
 */
export async function fetchActivityLogPage(
  db: SupabaseClient,
  vendorId: string,
  before?: string,
): Promise<{ logs: ActivityLogItem[]; hasMore: boolean } | null> {
  let query = db
    .from("vendor_activity_logs")
    .select("id, actor_name, action, summary, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(ACTIVITY_LOG_PAGE_SIZE + 1);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) return null;

  const rows = data ?? [];
  return {
    logs: rows.slice(0, ACTIVITY_LOG_PAGE_SIZE).map((row) => ({
      id: row.id as number,
      // 名前が空なのは、退会したメンバー・運営の操作など
      actorName: (row.actor_name as string | null) ?? "（退会したメンバーなど）",
      action: row.action as string,
      label: (VENDOR_ACTIVITY_LABELS as Record<string, string>)[row.action as string] ?? (row.action as string),
      summary: row.summary as string,
      createdAt: row.created_at as string,
    })),
    hasMore: rows.length > ACTIVITY_LOG_PAGE_SIZE,
  };
}
