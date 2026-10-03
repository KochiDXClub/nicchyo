/**
 * ログインアカウントの表示名と写真の URL を、user_metadata から決める（表示専用）。
 *
 * name / full_name / avatar_url は Google ログインのたびに、Google の値で上書きされることがある。
 * 本人がアカウント設定で変えた名前・写真は、Google が触らない専用のキー（display_name / avatarUrl）に入れ、
 * それがあれば優先する。
 * user_metadata は本人が書き換えられる値なので、表示にだけ使い、権限の判断には使わない。
 */
export const DISPLAY_NAME_MAX_LENGTH = 40;

type ProfileMetadata = {
  display_name?: unknown;
  name?: unknown;
  full_name?: unknown;
  avatarUrl?: unknown;
  avatar_url?: unknown;
  picture?: unknown;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** 表示名。専用のキー → Google の名前 → メールアドレスの @ より前、の順 */
export function resolveDisplayName(
  user: { email?: string | null; user_metadata?: ProfileMetadata | null },
  fallback = "名前未設定",
): string {
  const meta = user.user_metadata;
  const name =
    text(meta?.display_name) ??
    text(meta?.name) ??
    text(meta?.full_name) ??
    (user.email ? user.email.split("@")[0] : undefined);
  return name?.slice(0, 100) || fallback;
}

/** Google アカウントの写真が置かれているホスト（next.config.js の remotePatterns と同じ） */
const GOOGLE_AVATAR_HOST = "lh3.googleusercontent.com";
/** このサイトの Storage の、アカウント写真のバケットのパス（supabase/migrations/20261004100000） */
const AVATAR_STORAGE_PATH = "/storage/v1/object/public/user-avatars/";

/**
 * 表示してよい写真の URL か。user_metadata.avatarUrl は本人が自由な文字列に書き換えられるため、
 * 外部のサーバーの URL をそのまま他のメンバーや運営の画面に出すと、見た人の IP やブラウザの情報が相手に届いてしまう。
 * 許すのは、このサイトの Storage（user-avatars）と、Google の写真のホストだけ。
 */
export function isAllowedAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    if (parsed.hostname === GOOGLE_AVATAR_HOST) return true;
    const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
    return !!storageHost && parsed.hostname === storageHost && parsed.pathname.startsWith(AVATAR_STORAGE_PATH);
  } catch {
    return false;
  }
}

/**
 * 写真の URL。本人が設定した写真があればそれ、削除したとき（空文字）は写真なし、
 * 何も設定していなければ Google の写真。表示してよい URL（isAllowedAvatarUrl）でなければ、写真なしにする。
 */
export function resolveAvatarUrl(user: { user_metadata?: ProfileMetadata | null }): string | undefined {
  const meta = user.user_metadata;
  const url =
    typeof meta?.avatarUrl === "string" ? meta.avatarUrl.trim() || undefined : (text(meta?.avatar_url) ?? text(meta?.picture));
  return url && isAllowedAvatarUrl(url) ? url : undefined;
}
