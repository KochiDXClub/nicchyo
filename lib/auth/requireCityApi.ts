/**
 * 高知市（市役所）向け API ルートの認可ガード
 *
 * requireAdminApi と同じ形で、通すロールだけが違う。
 *   city_official … 市役所の担当者
 *   admin         … 運営（動作確認・代行のため）
 * moderator は通さない（運営の下位ロールであって、市役所とは別系統）。
 *
 * 判定は app_metadata.role のみ。user_metadata は改ざん可能なので使わない。
 * RLS をバイパスする service role を返すので、ルート側は「許可した操作」だけを書くこと。
 * 管理 API（/api/admin/*）には絶対に流用しない。
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminServiceClient, type AdminApiContext } from "./requireAdminApi";
import { canAccessCity, getRole } from "./permissions";

export type CityApiContext = AdminApiContext;

/**
 * city_official / admin でなければ 401 を返す。
 *
 * ```ts
 * const auth = await requireCityApi();
 * if ("error" in auth) return auth.error;
 * ```
 */
export async function requireCityApi(): Promise<CityApiContext | { error: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  // getUser() は認証サーバに問い合わせて JWT を検証するので、クッキーの偽造では通らない
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = getRole(user);
  if (!user || !canAccessCity(role)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, role, adminClient: createAdminServiceClient() };
}
