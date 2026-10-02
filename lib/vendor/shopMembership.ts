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

/**
 * アカウントの所属店舗を1件返す（1アカウント1店舗。所属がなければ null）。
 * RLS により、読めるのは自分の店舗の行だけ。失敗したときも null を返し、呼び出し側は「所属なし」として扱う
 * （権限を誤って広げるより、締め出す側に倒す）。
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
    return null;
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
