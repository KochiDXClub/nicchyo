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
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { getRole, isAdmin } from "./permissions";

export type AdminApiContext = {
  // 検証済みセッションの User をそのまま渡す。id だけに絞ると、監査ログに
  // actor_email / actor_role を書きたくなったときに型で到達できない
  user: User;
  /** getRole(user) の結果。監査ログの actor_role にそのまま入れる */
  role: string | null;
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

  const role = getRole(user);
  if (!user || !isAdmin(role)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, role, adminClient: createAdminServiceClient() };
}

/**
 * admin ロールでなければ弾く、requireAdminApi() の簡易版。
 *
 * 呼び出し側で `{ user, error }` の形をそのまま使い続けている既存ルートが
 * 多いため、そちらに合わせた戻り値の形で用意している
 * （エラーを NextResponse ではなく文字列で返す。呼び出し側は自前で
 * `NextResponse.json({ error }, { status: 403 })` 等に変換する）。
 * `adminClient` は含まないので、必要なら `@/lib/supabase/adminClient` の
 * createAdminClient() を別途呼ぶこと。
 *
 * 新規に書くルートは requireAdminApi() を使うことを推奨する
 * （adminClient・role がまとめて手に入り、401レスポンスも直接返せるため）。
 * これは、既に authorizeAdmin() の形で書かれている既存ルート向けの
 * 共通化用エクスポート（Issue: 共通化調査で見つかった重複）。
 */
export async function authorizeAdmin(): Promise<
  { user: User; error: null } | { user: null; error: string }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}
