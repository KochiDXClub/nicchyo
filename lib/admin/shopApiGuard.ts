/**
 * 運営が店舗を書き換える API（/api/admin/shops/[id]/**）に共通の入口。
 * 同一オリジン → レート制限 → 管理者の認可、の順に確かめる。
 * ルートごとに写すと、片方だけ直して片方が取り残される（認可の順序や上限が食い違う）ので、ここに置く。
 */
import type { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { requireAdminApi, type AdminApiContext } from "@/lib/auth/requireAdminApi";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminShopWriteContext = AdminApiContext & {
  /** 監査ログ用。取れなければ null */
  ip: string | null;
};

export async function guardAdminShopWrite(
  request: Request,
  rate: { bucket: string; limit: number },
): Promise<{ ctx: AdminShopWriteContext } | { error: NextResponse }> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { error: originCheck.response };

  const rateLimited = await enforceRateLimit(request, { ...rate, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return { error: rateLimited };

  const auth = await requireAdminApi();
  if ("error" in auth) return { error: auth.error };

  const ip = getClientIp(request);
  return { ctx: { ...auth, ip: ip !== "unknown" ? ip : null } };
}
