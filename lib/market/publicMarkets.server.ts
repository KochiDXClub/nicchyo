import { createAnonClient } from "@/lib/supabase/anonClient";

export type PublicMarket = {
  id: string;
  slug: string;
  name: string;
  weekday: number;
};

/**
 * 公開中の市だけを読む（非公開の市は RLS で見えない。anon クライアントで読むので、この関数でも二重に絞る）。
 * 取得できなければ空の一覧を返し、画面は市のない状態として表示する。
 */
export async function fetchPublicMarkets(): Promise<PublicMarket[]> {
  const client = createAnonClient();
  if (!client) return [];
  const { data, error } = await client
    .from("markets")
    .select("id,slug,name,weekday")
    .eq("is_public", true)
    .order("weekday", { ascending: true });
  if (error || !data) return [];
  return data as PublicMarket[];
}

export async function fetchPublicMarketBySlug(slug: string): Promise<PublicMarket | null> {
  const markets = await fetchPublicMarkets();
  return markets.find((market) => market.slug === slug) ?? null;
}
