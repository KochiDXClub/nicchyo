/**
 * 検索用に文字をそろえる（検索語と検索対象の両方に同じ関数をかける）
 *
 * - NFKC: 全角英数→半角、半角カタカナ→全角カタカナ
 * - 小文字化
 * - カタカナ→ひらがな（U+30A1〜U+30F6 を 0x60 引く。長音「ー」U+30FC は対象外）
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
