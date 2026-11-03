import type { TranslationStatus } from "./schema";

/** 英語版の状態。none = 英語版なし、fresh = 日本語に合っている、stale = 訳したあとに日本語を変えた */
export type EnglishState = "none" | "fresh" | "stale";

/**
 * 管理画面で、英語版が今の日本語に合っているかを見分ける。
 * `translatedFrom` は、英語版を作った（または保存済みを読み込んだ）時点の日本語。
 * 日本語を直したのに英語が古いまま公開されるのを防ぐために、投稿前に警告する。
 */
export function englishState(params: {
  title: string;
  body: string;
  titleEn: string;
  bodyEn: string;
  translatedFrom: { title: string; body: string } | null;
}): EnglishState {
  const { title, body, titleEn, bodyEn, translatedFrom } = params;
  if (!titleEn.trim() && !bodyEn.trim()) return "none";
  if (translatedFrom && (translatedFrom.title.trim() !== title.trim() || translatedFrom.body.trim() !== body.trim())) return "stale";
  return "fresh";
}

export const TRANSLATION_STATUS_LABEL: Record<TranslationStatus, string> = {
  auto: "AI翻訳のまま",
  reviewed: "手直し済み",
};
