/**
 * nearbyRecommendations
 *
 * 「このへん、なにがある？」パネルに出す、おすすめ店舗の選定ロジック。
 * ユーザーの行動シグナル（お気に入り・買い物リスト等から
 * 導いた興味ジャンル）を使い、範囲内の店舗から4〜5店を選ぶ。
 *
 * 【設計方針】
 * - 決定論的（LLM不使用）で、選定理由をユーザーに説明できること
 * - rich-get-richer を避ける: 興味一致だけで埋めず、必ず「出会い」枠
 *   （まだ選ばれていないジャンルの近い店）を残す
 * - 入力の areaShops は中心から近い順であることを前提とする
 */

export type NearbyRecommendationReason =
  /** お気に入り登録済みの店がこの範囲にある */
  | 'favorite'
  /** 行動シグナルから推定した興味ジャンルに一致 */
  | 'interest'
  /** 多様性のための出会い枠（未登場ジャンルの近い店） */
  | 'discovery';

export type NearbyRecommendation<T> = {
  shop: T;
  reason: NearbyRecommendationReason;
};

const DEFAULT_LIMIT = 5;
/** お気に入りで埋め尽くさないための上限 */
const MAX_FAVORITE_PICKS = 2;
/** 出会い枠を最低1つ残すための興味枠の控え */
const RESERVED_DISCOVERY_SLOTS = 1;

/**
 * 範囲内の店舗（近い順）からおすすめを選ぶ
 *
 * @param areaShops 範囲内の店舗（中心から近い順）
 * @param favoriteShopIds お気に入り登録済みの店舗ID
 * @param interestCategories 行動シグナル由来の興味ジャンル（強い順）
 */
export function selectNearbyRecommendations<
  T extends { id: number; category?: string }
>(
  areaShops: T[],
  {
    favoriteShopIds,
    interestCategories,
    limit = DEFAULT_LIMIT,
  }: {
    favoriteShopIds: Set<number>;
    interestCategories: string[];
    limit?: number;
  }
): NearbyRecommendation<T>[] {
  const picks: NearbyRecommendation<T>[] = [];
  const pickedIds = new Set<number>();

  const pick = (shop: T, reason: NearbyRecommendationReason) => {
    picks.push({ shop, reason });
    pickedIds.add(shop.id);
  };

  // 1. 範囲内にあるお気に入りの店（近い順・最大2つ）
  for (const shop of areaShops) {
    if (picks.length >= MAX_FAVORITE_PICKS) break;
    if (favoriteShopIds.has(shop.id)) {
      pick(shop, 'favorite');
    }
  }

  // 2. 興味ジャンルに一致する店（ジャンルの強い順→近い順）。
  //    出会い枠を最低1つ残す
  const interestBudget = Math.max(0, limit - picks.length - RESERVED_DISCOVERY_SLOTS);
  let interestPicked = 0;
  for (const category of interestCategories) {
    if (interestPicked >= interestBudget) break;
    for (const shop of areaShops) {
      if (interestPicked >= interestBudget) break;
      if (pickedIds.has(shop.id)) continue;
      if (shop.category === category) {
        pick(shop, 'interest');
        interestPicked += 1;
      }
    }
  }

  // 3. 出会い枠: まだ登場していないジャンルの店を近い順に
  const pickedCategories = new Set(
    picks.map((entry) => entry.shop.category).filter(Boolean)
  );
  for (const shop of areaShops) {
    if (picks.length >= limit) break;
    if (pickedIds.has(shop.id)) continue;
    if (shop.category && pickedCategories.has(shop.category)) continue;
    pick(shop, 'discovery');
    if (shop.category) pickedCategories.add(shop.category);
  }

  // 4. まだ枠が余っていれば近い順に埋める
  for (const shop of areaShops) {
    if (picks.length >= limit) break;
    if (pickedIds.has(shop.id)) continue;
    pick(shop, 'discovery');
  }

  return picks;
}

/**
 * 行動シグナル（お気に入り・買い物リスト等で触れた店舗）から
 * 興味ジャンルを強い順に導く
 */
export function deriveInterestCategories(
  signalShopIds: number[],
  resolveCategory: (shopId: number) => string | undefined
): string[] {
  const counts = new Map<string, number>();
  for (const shopId of signalShopIds) {
    const category = resolveCategory(shopId);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
}
