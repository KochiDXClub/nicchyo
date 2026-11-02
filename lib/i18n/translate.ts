import enUi from "@/content/i18n/ui.en.json";
import type { Locale } from "./config";

/**
 * 画面の文言の辞書。キーは日本語の原文そのもの。
 * 訳が無い文言は原文（日本語）のまま出るので、未翻訳でも画面は欠けない。
 * 辞書が足りているかは lib/i18n/translate.test.ts が確かめる。
 */
const dictionaries: Partial<Record<Locale, Record<string, string>>> = {
  en: enUi,
};

export type Translate = (text: string) => string;

export function translate(locale: Locale, text: string): string {
  return dictionaries[locale]?.[text] ?? text;
}

export function createTranslator(locale: Locale): Translate {
  return (text) => translate(locale, text);
}
