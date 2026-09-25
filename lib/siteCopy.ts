import { createElement, type ReactNode } from "react";
import texts from "@/content/site-copy/texts.json";

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
export function siteTextWithEmphasis(key: SiteTextKey, className?: string): ReactNode[] {
  return siteText(key)
    .split("**")
    .map((part, i) => (i % 2 === 1 ? createElement("b", { key: i, className }, part) : part));
}
