import { createClient } from "@supabase/supabase-js";

/**
 * Cookie を持たない anon クライアント。全員で共有するキャッシュ（unstable_cache）の中で、
 * 公開してよい行（RLS を通る行）だけを読むのに使う。env 未設定時は null を返す
 */
export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
