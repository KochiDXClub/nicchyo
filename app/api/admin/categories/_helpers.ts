/**
 * createAdminClient・authorizeAdmin は、以前ここと events/_helpers.ts の
 * 両方に一字一句同じ内容で定義されていた（共通化調査で発見）。
 * 実装は共通の場所（lib/supabase/adminClient.ts・lib/auth/requireAdminApi.ts）
 * に1本化し、ここでは import 元を変えずに済むよう re-export だけする
 */
export { createAdminClient } from "@/lib/supabase/adminClient";
export { authorizeAdmin } from "@/lib/auth/requireAdminApi";
