import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type AdminAuditRow = {
  actor_id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address: string | null;
};

/**
 * 管理API共通の監査ログ記録。
 *
 * `admin_audit_logs` への insert は、各管理APIルートがそれぞれ個別に
 * 手書きしていた（同じ形の insert が21ファイル・25箇所以上に散らばっていた）。
 * 片方のルートで書式を直しても他が取り残される、エラーを確認せず握りつぶす
 * ルートがある、といった劣化が起きていたため、ここ1箇所にまとめる。
 *
 * `lib/auth/requireAdminApi.ts` が認可チェックの重複を防いだのと同じ理由で、
 * その直後にほぼ必ず続く監査ログの記録もここで共通化する。
 */

export type AdminAuditActor = {
  id: string;
  email?: string | null;
  /** getRole(user) の結果、またはそれと同じ値。actor_role にそのまま入る */
  role: string | null;
};

export type AdminAuditEntry = {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetName?: string | null;
  /** JSON文字列・平文どちらも可（呼び出し元でこれまで両方使われていたため） */
  details?: string | null;
  ipAddress?: string | null;
};

/**
 * `admin_audit_logs` に1件記録する。
 *
 * 監査ログの記録失敗で呼び出し元の本処理（保存・削除など）を巻き戻すことは
 * しない設計を踏襲し、ここでは例外を投げない。失敗した場合は理由が消えない
 * よう console.error にだけ残す（以前 market-days/route.ts で採られていた
 * パターンを共通化したもの）。
 */
function toRow(actor: AdminAuditActor, entry: AdminAuditEntry): AdminAuditRow {
  return {
    actor_id: actor.id,
    actor_email: actor.email ?? null,
    actor_role: actor.role,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    target_name: entry.targetName ?? null,
    details: entry.details ?? null,
    ip_address: entry.ipAddress ?? null,
  };
}

export async function logAdminAudit(
  client: SupabaseClient<Database>,
  actor: AdminAuditActor,
  entry: AdminAuditEntry
): Promise<void> {
  const { error } = await client.from("admin_audit_logs").insert(toRow(actor, entry));

  if (error) {
    console.error(`[audit] ${entry.action} の監査ログ記録に失敗しました`, error);
  }
}

/**
 * 複数件をまとめて1回の insert で記録する（ai-models/route.ts のような
 * 「変更した項目ぶんだけ複数行をまとめて残す」ケース用）。
 * 空配列のときは insert 自体を呼ばない
 */
export async function logAdminAuditBatch(
  client: SupabaseClient<Database>,
  actor: AdminAuditActor,
  entries: AdminAuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  const { error } = await client
    .from("admin_audit_logs")
    .insert(entries.map((entry) => toRow(actor, entry)));

  if (error) {
    console.error(`[audit] ${entries.length}件の監査ログ記録に失敗しました`, error);
  }
}
