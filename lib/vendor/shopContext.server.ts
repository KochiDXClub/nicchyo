import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireVendorRole } from "@/lib/auth/permissions";
import { fetchShopMembership, type ResolvedShopMembership } from "./shopMembership";
import { hasShopPermission, type ShopPermission } from "./shopPermissions";

type ServerClient = ReturnType<typeof createServerClient>;

export type VendorContext = {
  user: User;
  /** 操作する店舗の ID（vendors.id）。user.id ではない */
  vendorId: string;
  membership: ResolvedShopMembership;
  /** そのアカウントの権限で動くクライアント（RLS が効く） */
  supabase: ServerClient;
};

export type VendorContextResult = ({ ok: true } & VendorContext) | { ok: false; response: NextResponse };

/**
 * 出店者向け API の入口。ログイン・出店者ロール・所属店舗・（指定すれば）操作権限を、この順に確かめる。
 *
 *   401 … ログインしていない
 *   403 … 出店者ではない / 店舗に入っていない / 権限が足りない
 *
 * permission を省くと「店舗のメンバーなら誰でも」。権限が要る操作は必ず指定すること
 * （RLS も同じ権限で守っているが、API 側でも先に弾いて、分かる文言で返す）。
 */
export async function requireVendorContext(options?: { permission?: ShopPermission }): Promise<VendorContextResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const forbidden = requireVendorRole(user);
  if (forbidden) return { ok: false, response: forbidden };

  const membership = await fetchShopMembership(supabase, user.id);
  if (!membership) {
    return { ok: false, response: NextResponse.json({ error: "店舗に紐づいていません" }, { status: 403 }) };
  }

  if (options?.permission && !hasShopPermission(membership, options.permission)) {
    return { ok: false, response: NextResponse.json({ error: "この操作をする権限がありません" }, { status: 403 }) };
  }

  return { ok: true, user, vendorId: membership.vendorId, membership, supabase };
}
