/**
 * 運営が店舗を書き換える API（/api/admin/shops/[id]/**）に共通の入口。
 * 同一オリジン → 管理者の認可 → レート制限（管理者ごと）、の順に確かめる。
 * ルートごとに写すと、片方だけ直して片方が取り残される（認可の順序や上限が食い違う）ので、ここに置く。
 */
import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { requireAdminApi, type AdminApiContext } from "@/lib/auth/requireAdminApi";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminShopWriteContext = AdminApiContext & {
  /** URL の店舗 ID（UUID の形は確認済み） */
  id: string;
  /** 監査ログ用。取れなければ null */
  ip: string | null;
};

/**
 * 店舗を指定しない書き込み（新規登録など）の入口。同一オリジン → 管理者の認可 → レート制限、の順。
 * 店舗を指定する書き込みは guardAdminShopWrite（中でこれを使う）。
 */
export async function guardAdminWrite(
  request: Request,
  rate: { bucket: string; limit: number; json?: boolean },
): Promise<{ ctx: AdminApiContext & { ip: string | null }; body: unknown } | { error: NextResponse }> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { error: originCheck.response };

  // 認可を先に通し、回数は管理者ごとに数える。日曜市の現地では、複数のスタッフが同じ Wi-Fi・同じ回線の
  // 共有 IP から同時に保存するので、IP で数えると、急に 429 になる。未ログインの呼び出しは、ここで弾かれる
  const auth = await requireAdminApi();
  if ("error" in auth) return { error: auth.error };

  const rateLimited = await enforceRateLimit(request, {
    bucket: rate.bucket,
    limit: rate.limit,
    windowMs: 10 * 60 * 1000,
    identity: auth.user.id,
  });
  if (rateLimited) return { error: rateLimited };

  let body: unknown = null;
  if (rate.json) {
    try {
      body = await request.json();
    } catch {
      return { error: NextResponse.json({ error: "リクエストの形が正しくありません" }, { status: 400 }) };
    }
  }

  const ip = getClientIp(request);
  return { ctx: { ...auth, ip: ip !== "unknown" ? ip : null }, body };
}

/**
 * @param json true のとき、本文を JSON として読んで body に入れる（読めなければ 400）。写真など JSON でないものは false
 */
export async function guardAdminShopWrite(
  request: Request,
  params: Promise<{ id: string }>,
  rate: { bucket: string; limit: number; json?: boolean },
): Promise<{ ctx: AdminShopWriteContext; body: unknown } | { error: NextResponse }> {
  // 店舗の ID の形は、本文を読む前に確かめる（認可・回数の確認は guardAdminWrite と同じ）
  const guard = await guardAdminWrite(request, rate);
  if ("error" in guard) return guard;
  const { id } = await params;
  if (!UUID_RE.test(id)) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  return { ctx: { ...guard.ctx, id }, body: guard.body };
}
