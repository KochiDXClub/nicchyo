import { timingSafeEqual } from "node:crypto";

/**
 * Authorization ヘッダーの Bearer トークンが secret と一致するかを定数時間で比較する。
 * secret が空・ヘッダーが Bearer 形式でない場合は常に false。
 */
export function verifyBearerSecret(authHeader: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !authHeader) return false;
  const match = /^Bearer (.+)$/.exec(authHeader);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  // 長さが違うと timingSafeEqual が例外になるため、先に弾く
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
