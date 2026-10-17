/**
 * 多言語対応の土台（docs/I18N.md）。
 * 日本語が原文で、URL は無印（/map）。他言語は /en/map のようにロケールを頭に付ける。
 * このファイルは純粋関数だけを持つ（proxy.ts・サーバー・クライアントのどこからでも読める）。
 */
export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";

/** 選んだ言語を覚える Cookie。URL に /en が付いていないリンクでも、選んだ言語で表示し続けるため */
export const LOCALE_COOKIE = "nicchyo-locale";
/** proxy.ts が決めたロケールをサーバーコンポーネントへ渡すリクエストヘッダー */
export const LOCALE_HEADER = "x-locale";

/** 画面に出す言語名（その言語自身の表記） */
export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** 不明な値は既定の日本語に倒す */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * パスの頭のロケールを外す。
 * "/en/map" → { locale: "en", pathname: "/map" }、"/map" → { locale: null, pathname: "/map" }。
 * 既定言語（ja）のプレフィックスは付けない運用なので、"/ja/…" は対象にしない
 */
export function stripLocalePrefix(pathname: string): { locale: Locale | null; pathname: string } {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix) return { locale, pathname: "/" };
    if (pathname.startsWith(`${prefix}/`)) return { locale, pathname: pathname.slice(prefix.length) };
  }
  return { locale: null, pathname };
}

/** パスにロケールを付ける。既定言語は無印。すでに付いているロケールは付け替える */
export function localizePath(pathname: string, locale: Locale): string {
  const base = stripLocalePrefix(pathname).pathname;
  if (locale === DEFAULT_LOCALE) return base;
  return base === "/" ? `/${locale}` : `/${locale}${base}`;
}

/** 多言語化の対象外のパス（管理・出店者・API など）。ロケールのプレフィックスを付けない */
const UNLOCALIZED_PREFIXES = ["/api", "/admin", "/moderator", "/vendor", "/my-shop", "/oauth", "/maintenance"];

export function isLocalizablePath(pathname: string): boolean {
  return !UNLOCALIZED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
