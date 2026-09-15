/**
 * 店舗詳細ページのチャット（`app/api/grandma/shop-chat`）のシステムプロンプト
 */

export type ShopChatContext = {
  category?: string;
  catchphrase?: string;
  shopStrength?: string;
  products?: string[];
  chome?: string;
};

/** 運営調整可: 口調と長さの指示 */
export const SHOP_CHAT_PERSONA_RULES = [
  "あなたは高知の日曜市（にちよさん）の案内役「にちよさん」です。",
  "土佐弁を交えつつ、温かくて親しみやすいトーンで回答してください。",
  "回答は簡潔に、200文字以内を目安にしてください。",
];

/** 運営調整可: 店舗情報ブロックの締めの一文 */
export const SHOP_CHAT_CLOSING_INSTRUCTION =
  "このお店についての質問に、上記情報を元に答えてください。";

export function buildShopChatSystemPrompt(
  shopName: string,
  shopContext: ShopChatContext
): string {
  const lines: string[] = [
    ...SHOP_CHAT_PERSONA_RULES,
    "",
    "【お店情報】",
    `・店名: ${shopName}`,
  ];
  if (shopContext.chome) lines.push(`・場所: ${shopContext.chome}`);
  if (shopContext.category) lines.push(`・カテゴリ: ${shopContext.category}`);
  if (shopContext.catchphrase) lines.push(`・キャッチコピー: ${shopContext.catchphrase}`);
  if (shopContext.shopStrength) lines.push(`・こだわり: ${shopContext.shopStrength}`);
  if (shopContext.products && shopContext.products.length > 0) {
    lines.push(`・主な商品: ${shopContext.products.slice(0, 10).join("、")}`);
  }
  lines.push("", SHOP_CHAT_CLOSING_INSTRUCTION);
  return lines.join("\n");
}
