import { createAnonClient } from "@/lib/supabase/anonClient";

export type PublicMarket = {
  id: string;
  slug: string;
  name: string;
  weekday: number;
};

/** 公開中の市だけを読む。カレンダーでは取得失敗と公開中の市がゼロの状態を区別する。 */
export async function readPublicMarkets(client: NonNullable<ReturnType<typeof createAnonClient>>): Promise<PublicMarket[]> {
  const { data, error } = await client
    .from("markets")
    .select("id,slug,name,weekday")
    .eq("is_public", true)
    .order("weekday", { ascending: true })
    .order("id");
  if (error) throw error;
  return data;
}

export async function fetchPublicMarkets(): Promise<PublicMarket[]> {
  const client = createAnonClient();
  return client ? readPublicMarkets(client).catch(() => []) : [];
}

export async function fetchPublicMarketBySlug(slug: string): Promise<PublicMarket | null> {
  const markets = await fetchPublicMarkets();
  return markets.find((market) => market.slug === slug) ?? null;
}
