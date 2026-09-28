/**
 * はじめての方への案内パネルで動かすデモ用の店舗。
 *
 * 【なぜ作り物のデータを並べないか】
 * 案内の目的は「本物の地図で何が起きるか」を先に体験してもらうこと。
 * マップページは既に全店舗を読み込んでいるので、そこから数件借りて
 * 本物のマーカー生成（markerHtmlGenerator）と本物のバナー（ShopBannerHero）に流す。
 * 見た目も、タップしたときの挙動も、実物と同じものになる。
 *
 * 店舗データがまだ無い（取得に失敗した・開発環境で空）ときだけ、
 * 案内が空白にならないよう最小限の控えを使う。
 */

import type { Shop } from '../../types/shopData';
import { SHOP_CATEGORY_NAMES } from '../../config/shopCategories';

/** デモの道に並べる件数。通りを歩いた感じが出るだけの数を置く */
export const INTRO_DEMO_SHOP_COUNT = 6;

/**
 * 案内で使うぶんだけを持つ、軽い店舗の形。
 *
 * ShopBannerHero と generateShopMarkerHtml が Shop を要求するので、
 * 実体としては Shop を渡す。この型は「案内が実際に読む項目」を明示するためのもの。
 */
export type IntroDemoShop = Shop & { category: string };

function hasUsableName(shop: Shop): boolean {
  return typeof shop.name === 'string' && shop.name.trim().length > 0;
}

/**
 * カテゴリがばらけるように選ぶ。
 *
 * 同じカテゴリばかりだと屋台の色が揃ってしまい、「カテゴリごとに色が違う」
 * という地図の読み方が伝わらない。カテゴリ順に1件ずつ拾い、足りなければ
 * 残りから補う。並びは id 順に固定して、開くたびに変わらないようにする。
 */
export function pickIntroDemoShops(
  shops: Shop[] | undefined,
  count: number = INTRO_DEMO_SHOP_COUNT
): IntroDemoShop[] {
  const usable = (shops ?? []).filter(hasUsableName);
  if (usable.length === 0) return FALLBACK_DEMO_SHOPS.slice(0, count);

  const byCategory = new Map<string, Shop[]>();
  for (const shop of usable) {
    const key = shop.category || '';
    const list = byCategory.get(key);
    if (list) list.push(shop);
    else byCategory.set(key, [shop]);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  const picked: Shop[] = [];
  const seen = new Set<number>();
  // まずカテゴリを1周して、色がばらけるようにする
  for (const category of SHOP_CATEGORY_NAMES) {
    if (picked.length >= count) break;
    const first = byCategory.get(category)?.[0];
    if (first && !seen.has(first.id)) {
      picked.push(first);
      seen.add(first.id);
    }
  }
  // 足りなければ id 順で補う
  if (picked.length < count) {
    for (const shop of [...usable].sort((a, b) => a.id - b.id)) {
      if (picked.length >= count) break;
      if (seen.has(shop.id)) continue;
      picked.push(shop);
      seen.add(shop.id);
    }
  }

  return picked.slice(0, count).map((shop) => ({
    ...shop,
    category: shop.category || '食材',
  }));
}

/**
 * 検索デモ用。少数のカテゴリから複数件ずつ取る。
 *
 * カテゴリ1件ずつだと「絞り込んだら1件だけ残った」になり、絞り込みの手応えが出ない。
 * 同じカテゴリの店が複数まとまって残るところまで見せたいので、こちらは別に選ぶ。
 */
export function pickIntroSearchShops(
  shops: Shop[] | undefined,
  categories: readonly string[],
  perCategory = 2
): IntroDemoShop[] {
  const usable = (shops ?? []).filter(hasUsableName);
  const source = usable.length > 0 ? usable : FALLBACK_DEMO_SHOPS;

  const picked: IntroDemoShop[] = [];
  for (const category of categories) {
    const inCategory = source
      .filter((shop) => (shop.category || '') === category)
      .sort((a, b) => a.id - b.id)
      .slice(0, perCategory);
    for (const shop of inCategory) {
      picked.push({ ...shop, category });
    }
  }
  return picked;
}

function fallbackShop(
  id: number,
  name: string,
  category: string,
  products: string[],
  catchphrase: string
): IntroDemoShop {
  return {
    id,
    name,
    category,
    products,
    ownerName: '',
    description: '',
    schedule: '',
    position: id,
    lat: 0,
    lng: 0,
    catchphrase,
  } as IntroDemoShop;
}

/**
 * 店舗データが無いときの控え。
 * 日曜市に実在する店を名乗らせないよう、品物そのものを名前にしている。
 */
export const FALLBACK_DEMO_SHOPS: IntroDemoShop[] = [
  fallbackShop(1, '野菜のお店', '食材', ['トマト', '生姜', '文旦'], '朝どれの野菜が並びます'),
  fallbackShop(2, '芋天のお店', '食べ物', ['芋天', '田舎寿司'], '揚げたてをその場で'),
  fallbackShop(3, '植木のお店', '植物・苗', ['鉢植え', '種'], '育てやすい苗もあります'),
  fallbackShop(4, '刃物のお店', '道具・工具', ['包丁', '鎌'], '土佐打刃物の店'),
  fallbackShop(5, '竹かごのお店', '生活雑貨', ['竹かご', 'ざる'], '手編みの竹細工'),
  fallbackShop(6, '果物のお店', '食材', ['文旦', 'みかん'], '土佐の柑橘が並びます'),
  fallbackShop(7, '田舎寿司のお店', '食べ物', ['田舎寿司', 'おはぎ'], '朝つくったものだけ'),
  fallbackShop(8, '花の苗のお店', '植物・苗', ['花の苗', '球根'], '季節の花の苗'),
  fallbackShop(9, '打刃物のお店', '道具・工具', ['鎌', '鉈'], '研ぎ直しもできます'),
  fallbackShop(10, '器のお店', '生活雑貨', ['食器', '箸'], '普段づかいの器'),
];
