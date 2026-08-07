import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

/**
 * カード画像のURLを検証する。
 *
 * next/image で描画するため、next.config.js の remotePatterns（Supabase Storage の
 * 公開バケットのみ）に載らないURLを保存すると、閲覧時にページごと落ちる。
 * 保存前に弾いて、外部URLの読み込み自体も防ぐ。
 */
export function validateImageUrl(
  value: unknown
): { url: string | null; error: string | null } {
  if (value === null || value === undefined || value === "") return { url: null, error: null };
  if (typeof value !== "string") return { url: null, error: "画像URLが無効です" };

  const trimmed = value.trim();
  if (!trimmed) return { url: null, error: null };
  if (trimmed.length > 500) return { url: null, error: "画像URLが長すぎます" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: null, error: "画像URLが無効です" };
  }

  const isSupabaseStorage =
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(".supabase.co") &&
    parsed.pathname.startsWith("/storage/v1/object/public/");

  if (!isSupabaseStorage) {
    return { url: null, error: "画像はSupabase Storageの公開URLのみ指定できます" };
  }

  return { url: trimmed, error: null };
}

export async function authorizeAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}
