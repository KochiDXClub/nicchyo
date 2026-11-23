/**
 * 英語版（/en/…）の検索エンジン向けの設定（docs/I18N.md）。
 * 純粋関数だけを持つ（layout・sitemap・テストのどこからでも読める）。
 */
import type { MetadataRoute } from "next";
import { localizePath, stripLocalePrefix, type Locale } from "./config";

/**
 * 英語版を検索に出してよいページのパス（日本語の原文のパス。例: "/map"）。
 * 本文・タイトル・説明の英訳がそろったページだけ足す。足したページは、
 * 英語版が index され、hreflang と sitemap（英語のURL）に載る。
 * 空の間は、すべての /en/ ページが noindex のまま。
 */
export const EN_INDEXABLE_PATHS: readonly string[] = [];

/** "/en/map/" → "/map"、"/en" → "/"。ロケールの接頭辞と末尾のスラッシュを外す */
export function normalizeBasePath(pathname: string): string {
  const { pathname: base } = stripLocalePrefix(pathname.split("?")[0] ?? "/");
  return base.replace(/\/+$/, "") || "/";
}

export function isEnglishIndexable(pathname: string, indexable: readonly string[] = EN_INDEXABLE_PATHS): boolean {
  return indexable.includes(normalizeBasePath(pathname));
}

/**
 * hreflang（alternates.languages）。英語版を index しないページでは undefined
 * （索引対象外のページを hreflang で指すと、検索エンジンが混乱するため）。
 * 値はパス。metadataBase で絶対URLになる
 */
export function englishAlternateLanguages(
  pathname: string,
  indexable: readonly string[] = EN_INDEXABLE_PATHS,
): Record<string, string> | undefined {
  if (!isEnglishIndexable(pathname, indexable)) return undefined;
  const base = normalizeBasePath(pathname);
  return { ja: base, en: localizePath(base, "en"), "x-default": base };
}

/** 英語の画面で、英語版が索引対象外のときの robots。それ以外は undefined（既定のまま）。pathname はロケールを外したパス */
export function englishRobotsFor(
  locale: Locale,
  pathname: string,
  indexable: readonly string[] = EN_INDEXABLE_PATHS,
): { index: false; follow: true } | undefined {
  if (locale !== "en") return undefined;
  return isEnglishIndexable(pathname, indexable) ? undefined : { index: false, follow: true };
}

/**
 * sitemap 用。英語版を索引するページには、英語のURLの項目を足し、
 * 両方の項目に言語別URL（alternates）を付ける。対象外のページはそのまま返す
 */
export function withEnglishSitemapVersions(
  entries: MetadataRoute.Sitemap,
  siteUrl: string,
  indexable: readonly string[] = EN_INDEXABLE_PATHS,
): MetadataRoute.Sitemap {
  return entries.flatMap((entry) => {
    const path = entry.url.startsWith(siteUrl) ? entry.url.slice(siteUrl.length) : entry.url;
    if (!isEnglishIndexable(path, indexable)) return [entry];
    const base = normalizeBasePath(path);
    const enUrl = `${siteUrl}${localizePath(base, "en")}`;
    const jaUrl = `${siteUrl}${base}`;
    const alternates = { languages: { ja: jaUrl, en: enUrl, "x-default": jaUrl } };
    return [
      { ...entry, url: jaUrl, alternates },
      { ...entry, url: enUrl, alternates },
    ];
  });
}
