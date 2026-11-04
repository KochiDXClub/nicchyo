import { logAdminAudit, type AdminAuditActor } from "@/lib/audit/logAdminAudit";
import type { MarketDayInput } from "./marketDayInput";

type AuditClient = Parameters<typeof logAdminAudit>[0];

export type SavedMarketDay = {
  market_date: string;
  status: string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 開催ステータスの登録・更新（運営・高知市で共通）。
 *
 * 1日1件なので同じ日付は upsert で上書きする。保存した内容は下書きを挟まず
 * 全ユーザーのマップ・近況ページ最上部に反映されるため、この機能で最も影響の大きい
 * 操作として、変更前後を必ず監査ログに残す。actor.role が運営か高知市かの区別になる。
 */
export async function saveMarketDay(
  dc: AuditClient,
  actor: AdminAuditActor,
  data: MarketDayInput
): Promise<{ day: SavedMarketDay } | { error: string }> {
  // 誤操作を事後に検証できるよう、上書き前の内容を控えておく
  const { data: previous } = await dc
    .from("market_days")
    .select("status, note")
    .eq("market_date", data.market_date)
    .maybeSingle();

  const { data: day, error } = await dc
    .from("market_days")
    .upsert({ ...data, updated_by: actor.id }, { onConflict: "market_date" })
    .select("*")
    .single();

  if (error || !day) return { error: "保存に失敗しました" };

  await logAdminAudit(dc, actor, {
    action: "market_day_updated",
    targetType: "market_day",
    targetId: data.market_date,
    details: JSON.stringify({
      before: previous ? { status: previous.status, note: previous.note } : null,
      after: { status: data.status, note: data.note },
    }),
  });

  return { day: day as SavedMarketDay };
}
