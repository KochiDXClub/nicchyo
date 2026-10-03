import { z } from "zod";

// お店の相談（POST /api/grandma/shop-chat）の入力。
// お店の情報は送らせない。shopId だけを受け取り、中身はサーバーが読む
// （送らせると、プロンプトに入る文面を利用者が自由に書き換えられてしまう）。

/** 引き継ぐ過去のやりとりの上限。これ以上は古いものから捨てる */
export const SHOP_CHAT_MAX_HISTORY = 12;
export const SHOP_CHAT_MAX_QUESTION_CHARS = 300;
/** 答えは 200 文字前後に収まるよう頼んでいるので、余裕を見た上限 */
export const SHOP_CHAT_MAX_HISTORY_ITEM_CHARS = 800;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(SHOP_CHAT_MAX_HISTORY_ITEM_CHARS),
});

export const ShopChatRequestSchema = z.object({
  shopId: z.number().int().positive(),
  text: z.string().trim().min(1).max(SHOP_CHAT_MAX_QUESTION_CHARS),
  history: z.array(MessageSchema).max(SHOP_CHAT_MAX_HISTORY * 4).default([]),
});

export type ShopChatRequest = z.infer<typeof ShopChatRequestSchema>;
export type ShopChatMessage = z.infer<typeof MessageSchema>;

/** 直近のやりとりだけを残す（先頭が assistant にならないように user から始める） */
export function trimShopChatHistory(history: readonly ShopChatMessage[]): ShopChatMessage[] {
  const recent = history.slice(-SHOP_CHAT_MAX_HISTORY);
  const firstUser = recent.findIndex((message) => message.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}
