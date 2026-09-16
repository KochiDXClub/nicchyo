import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { EMPTY_PAGE_VISIBILITY_SETTINGS, parsePageVisibilitySettings } from "@/lib/pageVisibility";

/**
 * ページ公開設定（公開API）
 *
 * クライアント側でリンクの表示/非表示を判定するために使う。
 * 設定自体は機密ではない（ロール別の公開状態とリダイレクト先のみ）。
 */

export const runtime = "nodejs";
// 60秒キャッシュ — proxy.ts 側のキャッシュ TTL と揃える
export const revalidate = 60;

export async function GET() {
  // page_visibility 行は RLS で anon にも読めるため、最小権限の publishable キーで読む
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(EMPTY_PAGE_VISIBILITY_SETTINGS);
  }

  try {
    const client = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await client
      .from("system_settings")
      .select("value")
      .eq("key", "page_visibility")
      .maybeSingle();

    return NextResponse.json(parsePageVisibilitySettings(data?.value));
  } catch {
    return NextResponse.json(EMPTY_PAGE_VISIBILITY_SETTINGS);
  }
}
