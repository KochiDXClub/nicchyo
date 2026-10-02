// 店舗の操作ログ（vendor_activity_logs）への書き込み。書き込みは API（service_role）だけ。
//
// 記録するのは「重要な操作の事実」だけ（誰が・何を・どの対象に）。メールアドレスや電話番号などの
// 個人情報は入れない。ログの書き込みに失敗しても、本来の操作は巻き戻さない（admin の監査ログと同じ方針）。

import type { SupabaseClient } from "@supabase/supabase-js";

export const VENDOR_ACTIVITY_LABELS = {
  "member.join": "招待リンクで参加した",
  "member.leave": "店舗を抜けた",
  "member.remove": "メンバーを外した",
  "member.permissions": "メンバーの権限を変えた",
  "invite.create": "招待リンクを作った",
  "invite.revoke": "招待リンクを取り消した",
  "owner.transfer": "代表者を引き継いだ",
  "qr.link": "QRコードで店舗に紐づけた",
  "qr.issue": "QRコードを発行（再発行）した",
  "qr.unlink": "店舗との紐づけを解除した",
} as const;

export type VendorActivityAction = keyof typeof VENDOR_ACTIVITY_LABELS;

export type VendorActivityEntry = {
  vendorId: string;
  /** 操作した人。運営の操作など「店舗のメンバーではない」ときは null */
  actorId: string | null;
  actorName: string | null;
  action: VendorActivityAction;
  targetType?: string | null;
  targetId?: string | null;
  /** 画面にそのまま出す一文（500 文字まで）。個人情報は入れない */
  summary: string;
  details?: Record<string, unknown> | null;
};

function toRow(entry: VendorActivityEntry) {
  return {
    vendor_id: entry.vendorId,
    actor_id: entry.actorId,
    actor_name: entry.actorName?.slice(0, 100) ?? null,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    summary: entry.summary.slice(0, 500),
    details: entry.details ?? null,
  };
}

/** 複数店舗への操作（QR の一括発行など）を、1 回の insert でまとめて記録する */
export async function logVendorActivities(db: SupabaseClient, entries: VendorActivityEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const { error } = await db.from("vendor_activity_logs").insert(entries.map(toRow));
    if (error) console.error("[vendorActivity] insert failed:", error.message);
  } catch (err) {
    console.error("[vendorActivity] insert threw:", err instanceof Error ? err.message : err);
  }
}

export async function logVendorActivity(db: SupabaseClient, entry: VendorActivityEntry): Promise<void> {
  try {
    const { error } = await db.from("vendor_activity_logs").insert(toRow(entry));
    if (error) console.error("[vendorActivity] insert failed:", error.message);
  } catch (err) {
    console.error("[vendorActivity] insert threw:", err instanceof Error ? err.message : err);
  }
}

/** 表示名。user_metadata は本人が書き換えられる文字なので、表示専用に使い、権限の判断には使わない */
export function displayNameOf(user: {
  email?: string | null;
  user_metadata?: { name?: string; full_name?: string } | null;
}): string {
  const meta = user.user_metadata;
  const name = meta?.name ?? meta?.full_name ?? (user.email ? user.email.split("@")[0] : "");
  return name.trim().slice(0, 100) || "名前未設定";
}
