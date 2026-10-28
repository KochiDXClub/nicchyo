import { revalidateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anonClient";
import type { Shop } from "../types/shopData";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { applyShopTranslations } from "@/lib/i18n/shopTranslation.server";
import {
  buildVendorShops,
  fetchActiveContentRows,
  fetchVendorShopBaseRows,
  type VendorShopBaseRows,
} from "./shopDb";

/**
 * 公開向けの店舗一覧（/map と /api/shops）。
 *
 * 店舗の基本データは 1 回あたり数百 KB あり、表示のたびに Supabase から取ると
 * 転送量がアクセス数に比例して増える。更新はまれなので Next.js のデータキャッシュに載せ、
 * 投稿（期限切れがある・数十 KB 程度）だけを毎回取って組み立てる。
 *
 * キャッシュは全員で共有するため、必ず Cookie を持たない anon クライアントで読む
 * （ログイン中の管理者・出店者にだけ見える非公開の行が他の来訪者へ漏れないようにする）。
 */

export const SHOP_BASE_CACHE_TAG = "map-shop-base";

// 出店者の編集はブラウザから Supabase へ直接書き込むため、キャッシュを捨てる合図が届かない。
// そのぶん反映の遅れがこの秒数までに収まるよう短めにしておく（管理画面の API からは即時に捨てる）。
const SHOP_BASE_REVALIDATE_SECONDS = 15 * 60;

const getCachedShopBaseRows = unstable_cache(
  async (): Promise<VendorShopBaseRows> => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    const { rows, failedTables } = await fetchVendorShopBaseRows(supabase);
    // 一部だけ欠けたデータをキャッシュすると、その間ずっと店舗が減って見えるため、
    // 失敗したときは例外にしてキャッシュさせない
    if (failedTables.length > 0) {
      throw new Error(`店舗データの取得に失敗しました: ${failedTables.join(", ")}`);
    }
    return rows;
  },
  // 行の形（取る列）を変えたら版を上げる。古い形のキャッシュを使い回さないため（v2: products.image_url）
  ["map-shop-base-rows-v2"],
  { revalidate: SHOP_BASE_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] }
);

/**
 * `locale` が日本語以外のときは、保存済みの訳（shop_translations）を重ねて返す。
 * 訳の無い店・項目は日本語のまま。店の並びや位置は言語によらず同じ。
 */
export async function fetchPublicShops(locale: Locale = DEFAULT_LOCALE): Promise<Shop[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const [baseRows, activeContents] = await Promise.all([
    getCachedShopBaseRows().catch(async (error: unknown) => {
      // キャッシュに載せられなかったときは、従来どおり取れた分だけで表示する
      console.warn("[fetchPublicShops] キャッシュを使わずに取得します:", error);
      return (await fetchVendorShopBaseRows(supabase)).rows;
    }),
    fetchActiveContentRows(supabase),
  ]);

  return applyShopTranslations(buildVendorShops(baseRows, activeContents), locale);
}

/** 管理画面の API で店舗・区画・カテゴリーを書き換えたあとに呼ぶ */
export function revalidatePublicShops() {
  revalidateTag(SHOP_BASE_CACHE_TAG, { expire: 0 });
}
