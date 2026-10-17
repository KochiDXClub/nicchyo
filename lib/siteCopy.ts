import { createElement, type ReactNode } from "react";
import texts from "@/content/site-copy/texts.json";
import enTexts from "@/content/i18n/en.json";
import type { Locale } from "@/lib/i18n/config";

/**
 * スプレッドシートで編集する文言のキー。
 * texts.json はシートから自動生成される（docs/SITE_COPY.md）。キーを打ち間違えると型エラーになる。
 */
export type SiteTextKey = keyof typeof texts;

export function siteText(key: SiteTextKey): string {
  return texts[key];
}

/**
 * 文言の中の **ここ** を <b> にして返す。
 * シートには HTML を書けないので、太字だけはこの書き方で表す（** の対は取り込み時に検証済み）。
 */
/**
 * ロケール別の文言。訳があればそれを、無ければ日本語の原文を返す（未翻訳でも画面は欠けない）。
 * 訳は content/i18n/<locale>.json に置く。シート管理の文言を多言語化する手順は docs/I18N.md
 */
const translations: Partial<Record<Locale, Partial<Record<SiteTextKey, string>>>> = {
  en: enTexts,
};

export function siteTextFor(key: SiteTextKey, locale: Locale): string {
  return translations[locale]?.[key] ?? texts[key];
}

export function siteTextWithEmphasis(key: SiteTextKey, className?: string): ReactNode[] {
  return siteText(key)
    .split("**")
    .map((part, i) => (i % 2 === 1 ? createElement("b", { key: i, className }, part) : part));
}
