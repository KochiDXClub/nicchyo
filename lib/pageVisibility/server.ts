import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole } from "@/lib/auth/permissions";
import { applyEnvironmentDefaults } from "./environment";
import { parsePageVisibilitySettings, resolvePageVisibility, toVisibilityRole } from "./resolve";
import { EMPTY_PAGE_VISIBILITY_SETTINGS, type PageVisibilitySettings } from "./types";

const CACHE_TTL_MS = 60_000;
let cache: { value: PageVisibilitySettings; expiresAt: number } | null = null;

/** 本番の既定を重ねたページ公開設定。取得に失敗しても既定は効く（本番では閉じる側に倒れる） */
export async function fetchEffectivePageVisibility(): Promise<PageVisibilitySettings> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;

  let stored = EMPTY_PAGE_VISIBILITY_SETTINGS;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const client = createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await client
        .from("system_settings")
        .select("value")
        .eq("key", "page_visibility")
        .maybeSingle();
      stored = parsePageVisibilitySettings(data?.value);
    } catch {
      // 既定のまま続ける
    }
  }
  const value = applyEnvironmentDefaults(stored);
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/**
 * いまのリクエストのユーザーが、そのパスを見てよいか。
 * proxy.ts の遮断が外れたとき（マッチャーの抜け・設定ミス）に備えた、ページ・API 側の二重の確認。
 * ロールは検証済みセッションの app_metadata から取る（user_metadata は改ざんできるので使わない）。
 */
export async function isPathVisibleToCurrentUser(path: string): Promise<boolean> {
  const settings = await fetchEffectivePageVisibility();
  let role = toVisibilityRole(null, false);
  try {
    const supabase = createServerClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    role = toVisibilityRole(getRole(user), !!user);
  } catch {
    // セッションが読めなければ未ログイン扱い
  }
  return resolvePageVisibility(path, role, settings).state !== "private";
}
