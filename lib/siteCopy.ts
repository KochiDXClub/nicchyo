import { createElement, type ReactNode } from "react";
import texts from "@/content/site-copy/texts.json";
import enTexts from "@/content/i18n/en.json";
import type { SiteTexts } from "@/lib/site-copy/Context";
import type { Locale } from "@/lib/i18n/config";
import type { SiteCopy } from "@/lib/site-copy/content";

/**
 * スプレッドシートで編集する文言のキー。
 * texts.json はシートから自動生成される（docs/SITE_COPY.md）。キーを打ち間違えると型エラーになる。
 */
export type SiteTextKey = keyof typeof texts;

export function siteText(key: SiteTextKey): string {
  return texts[key];
}

/**
 * ロケール別の文言。訳があればそれを、無ければ日本語の原文を返す（未翻訳でも画面は欠けない）。
 * 訳は content/i18n/<locale>.json に置く。シート管理の文言を多言語化する手順は docs/I18N.md
 */
const translations: Partial<Record<Locale, Partial<Record<SiteTextKey, string>>>> = {
  en: enTexts,
};

export function siteTextFor(key: SiteTextKey, locale: Locale, saved?: SiteTexts): string {
  const original = saved?.[key] ?? texts[key];
  return original === texts[key] ? translations[locale]?.[key] ?? original : original;
}

/**
 * 公開版（SiteCopy）から、今のロケールの文言を一つの表にする。
 * 英語は、管理画面で保存した英訳のうち、今の日本語の原文と合うものだけを使う。合わない・無いものは日本語のまま
 * （初期の英訳は siteTextFor が補う）。画面の共通部品（layout）と文言の読み出しはこれを通す。
 */
export function resolveSiteTexts(copy: SiteCopy, locale: Locale): SiteTexts {
  if (locale !== "en" || !copy.en) return copy.texts;
  const english = copy.en.texts;
  return Object.fromEntries(
    (Object.keys(copy.texts) as SiteTextKey[]).map((key) => {
      const entry = english[key];
      return [key, entry && entry.source === copy.texts[key] ? entry.text : copy.texts[key]];
    }),
  ) as SiteTexts;
}

/**
 * 文言の中の **ここ** を <b> にして返す。
 * シートには HTML を書けないので、太字だけはこの書き方で表す（** の対は取り込み時に検証済み）。
 */
export function siteTextWithEmphasis(key: SiteTextKey, className?: string): ReactNode[] {
  return emphasize(siteText(key), className);
}

export function siteTextWithEmphasisFor(key: SiteTextKey, locale: Locale, className?: string): ReactNode[] {
  return emphasize(siteTextFor(key, locale), className);
}

export function emphasize(text: string, className?: string): ReactNode[] {
  return text
    .split("**")
    .map((part, i) => (i % 2 === 1 ? createElement("b", { key: i, className }, part) : part));
}
