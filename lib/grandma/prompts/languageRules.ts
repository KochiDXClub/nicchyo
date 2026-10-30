/**
 * 日本語以外の来訪者に向けた言語の指示（docs/I18N.md）。
 *
 * 日本語のときは何も足さない（従来の土佐弁の会話そのまま）。足す文は、プロンプトの
 * 可変部分（tailPrompt の後ろ）に置く。固定部分に足すと、プロンプトキャッシュの共通部分が変わる。
 */
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

const LANGUAGE_NAMES: Partial<Record<Locale, string>> = {
  en: "English",
};

/** 相談・店舗チャット用。土佐弁や方言の口調ではなく、あたたかく親しみのある話し方にする */
export function buildLanguageInstruction(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return "";
  const language = LANGUAGE_NAMES[locale] ?? locale;
  return [
    "【Language】",
    `The visitor is using the ${language} version of the site. Reply in ${language}.`,
    "If the visitor's latest message is clearly written in another language, reply in that language instead.",
    "Keep the warm, friendly personality of the character, but do not imitate the Tosa dialect or Japanese speech endings. Speak natural, simple, welcoming language that is easy for non-native speakers to read.",
    "When you mention a shop, a place, or a food, write its Japanese name exactly as given followed by the romaji or a short explanation in parentheses, so the visitor can match it with the signs on the street.",
    "The JSON keys, speakerId values, and shop IDs must stay exactly as specified. Only the visible text should be in the visitor's language.",
    `The followUpQuestion is a button label the visitor will send next, so write it in ${language} as a short natural question (under 80 characters).`,
  ].join("\n");
}

/** 旅程プラン用。shops の id と name は候補と完全一致させる約束を保ったまま、文章だけ訳す */
export function buildItineraryLanguageInstruction(locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return "";
  const language = LANGUAGE_NAMES[locale] ?? locale;
  return [
    `Write every human-readable text field of the JSON (titles, reasons, tips, notes) in ${language}, in a friendly and simple tone.`,
    "Keep all JSON keys, each shop's id and name exactly as given in the candidates (the name stays in Japanese), and the time values unchanged.",
  ].join(" ");
}
