import { headers } from "next/headers";
import { LOCALE_HEADER, toLocale, type Locale } from "./config";
import { createTranslator, type Translate } from "./translate";
import { siteTextFor, type SiteTextKey } from "@/lib/siteCopy";

/** proxy.ts が決めたこのリクエストのロケール（サーバーコンポーネント用） */
export async function getLocale(): Promise<Locale> {
  return toLocale((await headers()).get(LOCALE_HEADER));
}

/** サーバーコンポーネント用の翻訳関数。t("お気に入り") のように日本語の原文を渡す */
export async function getT(): Promise<Translate> {
  return createTranslator(await getLocale());
}

/** サーバーコンポーネント用の、シートで編集する文言（siteText）の今のロケール版。訳が無いキーは日本語の原文になる */
export async function getSiteText(): Promise<(key: SiteTextKey) => string> {
  const locale = await getLocale();
  return (key) => siteTextFor(key, locale);
}
