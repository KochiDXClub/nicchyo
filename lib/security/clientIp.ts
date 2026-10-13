/**
 * 不正検知（ai_abuse_blocks / ai_abuse_events）に記録する接続元 IP を取り出す。
 *
 * rateLimit.ts の getClientIp とは取り方が違う（あちらは x-forwarded-for の先頭、こちらは末尾）。
 * 末尾は前段（Vercel のエッジ）が追記した値で、クライアントが x-forwarded-for を偽装しても書き換えられない。
 * 取れないときは null を返す（"unknown" という文字列は IP として記録しない）。
 */
export function getForwardedClientIp(request: Request): string | null {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    null;
  return ip && ip !== "unknown" ? ip : null;
}
