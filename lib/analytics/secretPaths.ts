import { stripLocalePrefix } from "@/lib/i18n/config";

/**
 * URL にトークンが入っているページ（QR・招待リンク）。
 * 解析テーブルや GA に URL が残ると、未使用のトークンが読めてしまうため、記録しない。
 */
const SECRET_PATH_PATTERN = /^\/(claim|join)(\/|$)/;

/** /en/claim/… のようにロケールが付いていても秘密のパスとして扱う */
export function isSecretTokenPath(path: string): boolean {
  return SECRET_PATH_PATTERN.test(stripLocalePrefix(path).pathname);
}

/**
 * 来訪者が自由に打った文が入るクエリ（トップの検索欄 → /map?q=、/consult?q=）。
 * 名前や電話番号が入りうるので、解析テーブルや GA には残さない（#1058）。
 */
const FREE_TEXT_PARAMS = ["q"];

/** 解析・GA に記録する形のパス。自由入力のクエリだけを外し、無ければ元の文字列のまま返す */
export function toTrackedPath(path: string): string {
  const queryStart = path.indexOf("?");
  if (queryStart < 0) return path;
  const params = new URLSearchParams(path.slice(queryStart + 1));
  if (!FREE_TEXT_PARAMS.some((key) => params.has(key))) return path;
  for (const key of FREE_TEXT_PARAMS) params.delete(key);
  const rest = params.toString();
  return rest ? `${path.slice(0, queryStart)}?${rest}` : path.slice(0, queryStart);
}
