import { normalizeSearchText } from "@/lib/search/normalizeSearchText";

/** 語の長さの範囲（表の CHECK と同じ。Postgres の char_length に合わせて、絵文字などは 1 文字と数える） */
const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 100;

type CatalogShop = { name: string; category: string; products: readonly string[] };

/**
 * 公開中の店舗から、辞書（正規化済みの店舗名・カテゴリー・商品名）を作る。
 * 店主名は、型にも値にも入れない（個人名なので）。呼び出し側が ownerName 付きのオブジェクトを渡しても拾わない。
 */
export function buildSearchTermDictionary(shops: readonly CatalogShop[]): string[] {
  const entries = new Set<string>();
  for (const shop of shops) {
    for (const text of [shop.name, shop.category, ...shop.products]) {
      const normalized = normalizeSearchText(text).trim();
      if (normalized) entries.add(normalized);
    }
  }
  return [...entries];
}

/**
 * 検索語が公開カタログ（店舗名・カテゴリー・商品名）に載っているかを調べる（#1069 案 B）。
 * 載っていれば正規化した語を返す。載っていなければ null（自由入力の名前・電話番号などは数えても語は残さない）。
 *
 * 一致 = 正規化した語が、正規化済みの辞書のどれかに部分一致する。
 * `dictionary` は normalizeSearchText をかけた文字列の配列で渡す（呼ぶたびに辞書を正規化しない）。
 * 辞書に店主名（ownerName）は入れないこと。個人名が「公開カタログの語」として残ってしまう。
 */
export function matchSearchTerm(raw: string, dictionary: readonly string[]): string | null {
  const term = normalizeSearchText(raw).trim();
  // 正規化で長くなる文字があるので、上限もここで見る（超えた語は表の CHECK で落ちて、件数ごと失われる）
  const length = [...term].length;
  if (length < MIN_TERM_LENGTH || length > MAX_TERM_LENGTH) return null;
  return dictionary.some((entry) => entry.includes(term)) ? term : null;
}
