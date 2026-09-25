import texts from "@/content/site-copy/texts.json";

/**
 * スプレッドシートで編集する文言のキー。
 * texts.json はシートから自動生成される（docs/SITE_COPY.md）。キーを打ち間違えると型エラーになる。
 */
export type SiteTextKey = keyof typeof texts;

export function siteText(key: SiteTextKey): string {
  return texts[key];
}

