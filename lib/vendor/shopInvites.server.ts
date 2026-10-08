import { createHash, randomBytes } from "node:crypto";

/** 招待リンクのトークン。推測できないよう 24 バイトの乱数（URL に安全な文字）にする */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

/** DB には本体を置かず、このハッシュだけを保存する（DB が漏れてもリンクとして使えない） */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
