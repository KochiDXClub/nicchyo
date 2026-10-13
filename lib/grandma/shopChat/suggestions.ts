import type { Shop } from "@/app/(public)/map/data/shops";

export type ShopChatSuggestion = { icon: string; text: string };

const MAX_SUGGESTIONS = 5;

/**
 * 「よく聞かれる質問」の候補。
 * そのお店のデータにあることだけを出す（答えの材料が無い質問を並べても
 * 「わからん」と返るだけで、押した人をがっかりさせる）。
 */
export function buildShopChatSuggestions(
  shop: Partial<Pick<Shop, "products" | "chome" | "schedule" | "paymentMethods" | "rainPolicy">>
): ShopChatSuggestion[] {
  const suggestions: ShopChatSuggestion[] = [];
  if (shop.products && shop.products.length > 0) suggestions.push({ icon: "🛍️", text: "どんな商品がありますか？" });
  suggestions.push({ icon: "⭐", text: "おすすめはなんですか？" });
  if (shop.chome) suggestions.push({ icon: "📍", text: "どのあたりにありますか？" });
  if (shop.paymentMethods && shop.paymentMethods.length > 0) {
    suggestions.push({ icon: "💴", text: "支払いは何が使えますか？" });
  }
  if (shop.schedule) suggestions.push({ icon: "🗓️", text: "次はいつ出店しますか？" });
  if (shop.rainPolicy) suggestions.push({ icon: "🌧️", text: "雨の日でも出店していますか？" });
  return suggestions.slice(0, MAX_SUGGESTIONS);
}
