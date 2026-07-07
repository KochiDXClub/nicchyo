import { createClient as createServiceClient } from "@supabase/supabase-js";

/** サービスロールキーで RLS を回避する管理用クライアント。env 未設定時は null を返す */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
