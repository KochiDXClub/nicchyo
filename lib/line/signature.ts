import { createHmac, timingSafeEqual } from "crypto";

/**
 * LINEプラットフォームからのWebhookリクエスト署名を検証する。
 *
 * LINEプラットフォームは、リクエスト本文のダイジェスト値を
 * チャネルシークレットを秘密鍵とした HMAC-SHA256 で計算し、
 * Base64エンコードして `x-line-signature` ヘッダーに付与して送信する。
 *
 * タイミング攻撃（Timing Attack）を防ぐため、比較には `crypto.timingSafeEqual` を使用する。
 *
 * @param rawBody - リクエストボディの生文字列（JSON.parseする前のRAWテキスト）
 * @param channelSecret - LINE Developersで取得したチャネルシークレット
 * @param signature - リクエストヘッダー `x-line-signature` の値
 */
export function validateLineSignature(
  rawBody: string,
  channelSecret: string,
  signature: string | null | undefined
): boolean {
  if (!signature || !channelSecret || !rawBody) {
    return false;
  }

  try {
    const computedSignature = createHmac("sha256", channelSecret)
      .update(rawBody, "utf8")
      .digest("base64");

    const computedBuffer = Buffer.from(computedSignature, "utf8");
    const providedBuffer = Buffer.from(signature, "utf8");

    if (computedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedBuffer, providedBuffer);
  } catch (err) {
    console.error("[LINE signature] Validation error:", err);
    return false;
  }
}
