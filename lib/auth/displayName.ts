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

/**
 * 写真の URL。本人が設定した写真があればそれ、削除したとき（空文字）は写真なし、
 * 何も設定していなければ Google の写真。
 */
export function resolveAvatarUrl(user: { user_metadata?: ProfileMetadata | null }): string | undefined {
  const meta = user.user_metadata;
  if (typeof meta?.avatarUrl === "string") return meta.avatarUrl.trim() || undefined;
  return text(meta?.avatar_url) ?? text(meta?.picture);
}
