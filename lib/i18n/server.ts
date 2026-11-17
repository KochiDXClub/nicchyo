import { headers } from "next/headers";
import { LOCALE_HEADER, toLocale, type Locale } from "./config";
import { createTranslator, type Translate } from "./translate";
import { siteTextFor, type SiteTextKey } from "@/lib/siteCopy";
import { getPublishedSiteCopy } from "@/lib/site-copy/server";

/** proxy.ts が決めたこのリクエストのロケール（サーバーコンポーネント用） */
export async function getLocale(): Promise<Locale> {
  return toLocale((await headers()).get(LOCALE_HEADER));
}

/** サーバーコンポーネント用の翻訳関数。t("お気に入り") のように日本語の原文を渡す */
export async function getT(): Promise<Translate> {
  return createTranslator(await getLocale());
}

/**
 * サーバーコンポーネント用の、管理画面の「サイト文言」で編集する文言の今のロケール版。
 * 公開版（getPublishedSiteCopy）を読む。訳が無いキー・日本語を直したキーは日本語になる
 */
export async function getSiteText(): Promise<(key: SiteTextKey) => string> {
  const [locale, copy] = await Promise.all([getLocale(), getPublishedSiteCopy()]);
  return (key) => siteTextFor(key, locale, copy.texts);
}
