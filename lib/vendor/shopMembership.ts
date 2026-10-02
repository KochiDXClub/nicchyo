// ログイン中のアカウントが「どの店舗の、どんな立場か」を引く。
// サーバー（API）とブラウザ（AuthContext）の両方から使うので、クライアントは引数で受け取る。
//
// 店舗の ID は vendors.id、アカウントの ID は auth.users.id で別物。
// 「自分の店舗の ID」が要るときに user.id を使わず、必ずここから取ること。

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseShopPermissions, type ShopMemberRole, type ShopMembership } from "./shopPermissions";

export type ResolvedShopMembership = ShopMembership & {
  vendorId: string;
  /** メンバーになった日時。お知らせの「登録より前」の判定などに使う */
  joinedAt: string | null;
};

type MembershipRow = {
  vendor_id: string;
  role: string;
  permissions: string[] | null;
  created_at: string | null;
};

/** 所属を引く通信そのものが失敗した（「所属なし」とは別。呼び出し側は「もう一度」を出す） */
export class ShopMembershipLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopMembershipLookupError";
  }
}

/**
 * アカウントの所属店舗を1件返す（1アカウント1店舗。所属がなければ null）。
 * RLS により、読めるのは自分の店舗の行だけ。
 * 通信などで引けなかったときは ShopMembershipLookupError を投げる。「所属なし」と取り違えると、
 * 一時的な失敗だけで代表者に「招待リンクで参加してください」と出してしまうため、呼び出し側が区別する。
 * どちらの場合も、権限は広げない（引けなければ何もさせない）。
 */
export async function fetchShopMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedShopMembership | null> {
  const { data, error } = await supabase
    .from("shop_members")
    .select("vendor_id, role, permissions, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[shopMembership] lookup failed:", error.message);
    throw new ShopMembershipLookupError(error.message);
  }
  if (!data) return null;

  const row = data as MembershipRow;
  const role: ShopMemberRole = row.role === "owner" ? "owner" : "member";
  return {
    vendorId: row.vendor_id,
    role,
    permissions: parseShopPermissions(row.permissions) ?? [],
    joinedAt: row.created_at,
  };
}

/**
 * このアカウントが、その店舗のメンバー（代表者を含む）か。
 * 自分の店舗を開いた分を、閲覧数などに数えないときに使う（user.id と店舗 ID は別物なので、user.id と比べてはいけない）。
 * service_role など、店舗をまたいで読めるクライアントを渡す。調べられなかったときは false（数える側に倒す）。
 */
export async function isShopMember(supabase: SupabaseClient, userId: string, vendorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("shop_members")
    .select("user_id")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[shopMembership] member check failed:", error.message);
    return false;
  }
  return data != null;
}
