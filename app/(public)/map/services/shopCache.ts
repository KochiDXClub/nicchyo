import { revalidateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anonClient";
import type { Shop } from "../types/shopData";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { applyShopTranslations } from "@/lib/i18n/shopTranslation.server";
import {
  applyShopDelta,
  buildVendorShops,
  fetchActiveContentRows,
  fetchShopDelta,
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
// そこで、キャッシュは全件を取り直す(この秒数ごと)のを基本にして、その上に「取得以降に変わった行」だけを
// 短い間隔(SHOP_DELTA_REVALIDATE_SECONDS)で重ねる。出店者の保存はほぼすぐ地図に出る。
// 全件の取り直しは、差分では見えない変更(店舗を出さなくなった・店主名を非公開にした等)を外すためにも要る
// （管理画面の API からは今までどおり即時に捨てる）。
const SHOP_BASE_REVALIDATE_SECONDS = 15 * 60;
const SHOP_DELTA_REVALIDATE_SECONDS = 30;
// 取得の開始と、行の updated_at(DB の時計)のずれや、取得中に確定した書き込みを取りこぼさないための余裕。
// 同じ行を二度重ねても結果は変わらない(id で置き換える)
const SHOP_DELTA_MARGIN_MS = 60 * 1000;

type CachedShopBase = { rows: VendorShopBaseRows; snapshotAt: string };

const getCachedShopBaseRows = unstable_cache(
  async (): Promise<CachedShopBase> => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    // 取得を始める前の時刻。差分はこの時刻以降に変わった行を取る
    const snapshotAt = new Date().toISOString();
    const { rows, failedTables } = await fetchVendorShopBaseRows(supabase);
    // 一部だけ欠けたデータをキャッシュすると、その間ずっと店舗が減って見えるため、
    // 失敗したときは例外にしてキャッシュさせない
    if (failedTables.length > 0) {
      throw new Error(`店舗データの取得に失敗しました: ${failedTables.join(", ")}`);
    }
    return { rows, snapshotAt };
  },
  // 行の形（取る列）を変えたら版を上げる。古い形のキャッシュを使い回さないため（v3: products.id・取得時刻）
  ["map-shop-base-rows-v3"],
  { revalidate: SHOP_BASE_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] }
);

// since ごとに別のキャッシュになる(基本データを取り直すと since が進み、前の差分は使われなくなる)
const getCachedShopDelta = unstable_cache(
  async (since: string) => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    return fetchShopDelta(supabase, since);
  },
  ["map-shop-delta-v1"],
  { revalidate: SHOP_DELTA_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] }
);

/**
 * `locale` が日本語以外のときは、保存済みの訳（shop_translations）を重ねて返す。
 * 訳の無い店・項目は日本語のまま。店の並びや位置は言語によらず同じ。
 */
export async function fetchPublicShops(locale: Locale = DEFAULT_LOCALE): Promise<Shop[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const [snapshot, activeContents] = await Promise.all([
    getCachedShopBaseRows().catch(async (error: unknown): Promise<{ rows: VendorShopBaseRows; snapshotAt: string | null }> => {
      // キャッシュに載せられなかったときは、従来どおり取れた分だけで表示する(取り立てなので差分は要らない)
      console.warn("[fetchPublicShops] キャッシュを使わずに取得します:", error);
      return { rows: (await fetchVendorShopBaseRows(supabase)).rows, snapshotAt: null };
    }),
    fetchActiveContentRows(supabase),
  ]);

  let baseRows = snapshot.rows;
  if (snapshot.snapshotAt) {
    try {
      const since = new Date(Date.parse(snapshot.snapshotAt) - SHOP_DELTA_MARGIN_MS).toISOString();
      baseRows = applyShopDelta(baseRows, await getCachedShopDelta(since));
    } catch (error) {
      // 差分が取れなくても、キャッシュしたデータで表示を続ける(反映が遅れるだけ)
      console.warn("[fetchPublicShops] 変わった行の取得に失敗しました。キャッシュのまま表示します:", error);
    }
  }

  return applyShopTranslations(buildVendorShops(baseRows, activeContents), locale);
}

/** 管理画面の API で店舗・区画・カテゴリーを書き換えたあとに呼ぶ */
export function revalidatePublicShops() {
  revalidateTag(SHOP_BASE_CACHE_TAG, { expire: 0 });
}
