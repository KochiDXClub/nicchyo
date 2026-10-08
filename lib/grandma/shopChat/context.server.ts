import { createAdminClient } from "@/lib/supabase/adminClient";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";
import type { Shop } from "@/app/(public)/map/data/shops";
import type { ShopChatContext, ShopChatNote } from "@/lib/grandma/prompts/shopChatPrompt";

// お店の相談に渡す材料を、サーバーが読む。
// 利用者から受け取るのは shopId だけで、店名・商品・メモはここで DB から引く。

export type LoadedShopChat = {
  shop: Shop;
  context: ShopChatContext;
  notes: ShopChatNote[];
};

const MAX_NOTES = 8;

/** 非公開のお店は、相談の相手にもしない */
export async function findPublicShop(shopId: number): Promise<Shop | null> {
  const shops = await fetchPublicShops();
  const shop = shops.find((candidate) => candidate.id === shopId);
  if (!shop || shop.visible === false) return null;
  return shop;
}

export function toShopChatContext(shop: Shop): ShopChatContext {
  return {
    category: shop.category,
    catchphrase: shop.catchphrase,
    shopStrength: shop.shopStrength,
    products: shop.products,
    chome: shop.chome,
    schedule: shop.schedule,
    paymentMethods: shop.paymentMethods,
    rainPolicy: shop.rainPolicy,
  };
}

/**
 * お店の人が「お客さんに渡す」と決めたメモ。
 * RLS は出店者本人にしか読ませないので、サーバーの鍵で読む。読めなくても相談は止めない。
 */
async function fetchVisitorNotes(vendorId: string): Promise<ShopChatNote[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("store_knowledge")
      .select("title, content")
      .eq("store_id", vendorId)
      .eq("for_visitors", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(MAX_NOTES);
    if (error || !data) return [];
    return (data as { title: string | null; content: string | null }[]).map((row) => ({
      title: row.title ?? "",
      content: row.content ?? "",
    }));
  } catch {
    return [];
  }
}

export async function loadShopChat(shopId: number): Promise<LoadedShopChat | null> {
  const shop = await findPublicShop(shopId);
  if (!shop) return null;
  const notes = shop.vendorId ? await fetchVisitorNotes(shop.vendorId) : [];
  return { shop, context: toShopChatContext(shop), notes };
}
