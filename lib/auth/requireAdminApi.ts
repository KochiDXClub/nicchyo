/**
 * 管理者向け API ルートの認可ガード
 *
 * 同じ実装が API ルートごとにコピーされていくと、片方だけ直して片方が
 * 取り残される形の劣化が起きる。認可の判定はここ1箇所に置く。
 *
 * ロール判定は lib/auth/permissions.ts の getRole() を使う。
 * user_metadata は改ざん可能なため判定に使わない（AuthContext と同じ方針）。
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { getRole, isAdmin } from "./permissions";

export type AdminApiContext = {
  user: { id: string };
  /** RLS をバイパスする service role クライアント */
  adminClient: SupabaseClient<DatabaseWithExtensions>;
};

export function createAdminServiceClient(): SupabaseClient<DatabaseWithExtensions> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role env vars are missing.");
  }
  return createServiceClient<DatabaseWithExtensions>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * admin ロールでなければ 401 を返す。
 *
 * ```ts
 * const auth = await requireAdminApi();
 * if ("error" in auth) return auth.error;
 * // auth.user / auth.adminClient が使える
 * ```
 */
export async function requireAdminApi(): Promise<
  AdminApiContext | { error: NextResponse }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  // getUser() は認証サーバに問い合わせて JWT を検証するので、クッキーの偽造では通らない
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, adminClient: createAdminServiceClient() };
}
