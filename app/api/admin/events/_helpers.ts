import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

/** アップロードAPIが書き込む場所。ここ以外のパスは受け付けない */
export const MARKET_EVENT_IMAGE_PREFIX =
  "/storage/v1/object/public/vendor-images/market-events/";

/**
 * カード画像のURLを検証する。
 *
 * 許可するのは「自プロジェクトのStorageの、アップロードAPIが書き込む場所」だけ。
 * `*.supabase.co` は誰でも取得できるサブドメインなので、ホスト名の後方一致で
 * 判定すると攻撃者のプロジェクトのURLが通り、公開カレンダーに任意の画像を
 * 配信されてしまう（保存後に差し替えも可能）。オリジン完全一致で塞ぐ。
 *
 * 完全一致にすることで next.config.js の remotePatterns（`*.supabase.co` は
 * 1ラベルのみマッチ）とのズレも消え、「検証は通るのに next/image が落ちる」
 * URLが保存されなくなる。ローカルの Supabase（127.0.0.1）でも同じ判定で通る。
 */
export function validateImageUrl(
  value: unknown
): { url: string | null; error: string | null } {
  if (value === null || value === undefined || value === "") return { url: null, error: null };
  if (typeof value !== "string") return { url: null, error: "画像URLが無効です" };

  const trimmed = value.trim();
  if (!trimmed) return { url: null, error: null };
  if (trimmed.length > 500) return { url: null, error: "画像URLが長すぎます" };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { url: null, error: "画像の保存先が設定されていません" };

  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(base).origin;
  } catch {
    return { url: null, error: "画像の保存先の設定が不正です" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: null, error: "画像URLが無効です" };
  }

  const isOwnUpload =
    parsed.origin === allowedOrigin &&
    parsed.pathname.startsWith(MARKET_EVENT_IMAGE_PREFIX) &&
    // エンコードされた ../ でプレフィックスの外に出るのを防ぐ
    !/%2e/i.test(parsed.pathname) &&
    !parsed.pathname.includes("..") &&
    !parsed.search &&
    !parsed.hash;

  if (!isOwnUpload) {
    return { url: null, error: "画像はこのサイトからアップロードしたものだけ指定できます" };
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
