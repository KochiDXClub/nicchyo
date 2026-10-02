/**
 * URL にトークンが入っているページ（QR・招待リンク）。
 * 解析テーブルや GA に URL が残ると、未使用のトークンが読めてしまうため、記録しない。
 */
const SECRET_PATH_PATTERN = /^\/(claim|join)(\/|$)/;

export function isSecretTokenPath(path: string): boolean {
  return SECRET_PATH_PATTERN.test(path);
}
