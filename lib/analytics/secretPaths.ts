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
