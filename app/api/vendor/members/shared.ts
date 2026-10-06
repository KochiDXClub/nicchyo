import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorContext, type VendorContext } from "@/lib/vendor/shopContext.server";
import { parseShopPermissions, type ShopMemberRole, type ShopPermission } from "@/lib/vendor/shopPermissions";
import type { MemberRef } from "@/lib/vendor/memberRules";

export type MembersApiContext = VendorContext & {
  /** service_role。shop_members の書き込みと auth.users の参照に使う（権限は呼び出し側で確かめ済み） */
  db: SupabaseClient;
  /** 操作している人 */
  me: MemberRef;
};

export type MembersApiResult = ({ ok: true } & MembersApiContext) | { ok: false; response: NextResponse };

/**
 * メンバー管理 API の入口。書き込み（write）は同じオリジンからであることと、回数も確かめる。
 * 権限（permission）は requireVendorContext が確かめ、足りなければ 403。
 */
export async function requireMembersApi(
  request: Request,
  options: { permission?: ShopPermission; write?: boolean; bucket?: string } = {},
): Promise<MembersApiResult> {
  if (options.write) {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return { ok: false, response: originCheck.response };
  }

  const auth = await requireVendorContext({ permission: options.permission });
  if (!auth.ok) return auth;

  if (options.write) {
    const limited = await enforceRateLimit(request, {
      bucket: options.bucket ?? "vendor-members-write",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      identity: auth.user.id,
    });
    if (limited) return { ok: false, response: limited };
  }

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return { ok: false, response: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };

  return {
    ...auth,
    ok: true,
    db,
    me: { userId: auth.user.id, role: auth.membership.role, permissions: auth.membership.permissions },
  };
}

export type MemberRow = {
  user_id: string;
  role: string;
  permissions: string[] | null;
  created_at: string;
};

export function toMemberRef(row: MemberRow): MemberRef {
  return {
    userId: row.user_id,
    role: (row.role === "owner" ? "owner" : "member") as ShopMemberRole,
    permissions: parseShopPermissions(row.permissions) ?? [],
  };
}

/** 同じ店舗のメンバー 1 人。店舗をまたいだ操作を防ぐため、必ず vendor_id でも絞る */
export async function findMember(db: SupabaseClient, vendorId: string, userId: string): Promise<MemberRow | null> {
  const { data } = await db
    .from("shop_members")
    .select("user_id, role, permissions, created_at")
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as MemberRow | null) ?? null;
}

export const NOT_FOUND = () => NextResponse.json({ error: "見つかりません" }, { status: 404 });
