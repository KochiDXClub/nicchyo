import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

/** サービスロールキーで RLS を回避する管理用クライアント。env 未設定時は null を返す */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * createAdminClient の、env 未設定時に例外を投げる版。
 * 未設定を 500 として扱いたい管理 API で使う（型付きが必要なら createTypedAdminClient）
 */
export function createAdminClientOrThrow() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase service role env vars are missing.");
  return client;
}

/**
 * 生成済み型（DatabaseWithExtensions）付きの service role クライアント。env 未設定時は null を返す。
 * 例外にしたい管理 API は lib/auth/requireAdminApi の createAdminServiceClient（これを包んだもの）を使う
 */
export function createTypedAdminClient(
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): SupabaseClient<DatabaseWithExtensions> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) return null;
  return createServiceClient<DatabaseWithExtensions>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
