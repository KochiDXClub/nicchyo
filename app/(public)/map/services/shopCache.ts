import { revalidateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anonClient";
import type { Shop } from "../types/shopData";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { applyShopTranslations } from "@/lib/i18n/shopTranslation.server";
import {
  buildVendorShops,
  fetchActiveContentRows,
  fetchVendorShopBaseRows,
  fetchVendorShopSupportRows,
  type VendorShopBaseRows,
  type VendorShopSupportRows,
} from "./shopDb";
import {
  createSupabaseDeltaSource,
  loadFullStore,
  storeToRows,
  syncStore,
  type DeltaStore,
} from "./shopDelta";

/**
 * 公開向けの店舗一覧（/map と /api/shops）。
 *
 * 店舗の基本データは 1 回あたり数百 KB あり、表示のたびに Supabase から取ると
 * 転送量がアクセス数に比例して増える。そこで、
 *  - 大きい vendors / products は、サーバーのメモリに持ち、1 分に 1 回だけ「前回から変わった行」を
 *    取って重ねる（差分更新。一日に一度は全件を読み直す。仕組みは shopDelta.ts）
 *  - 小さい店主名・カテゴリー・区画・出店履歴は、従来どおり Next.js のデータキャッシュに載せる
 *  - 投稿（期限切れがある・数十 KB 程度）は毎回取って組み立てる
 *
 * 出店者の編集はブラウザから Supabase へ直接書き込むが、DB のトリガーが updated_at を更新するので、
 * 次の差分更新で拾われる（以前は最大 15 分遅れていた）。
 *
 * キャッシュは全員で共有するため、必ず Cookie を持たない anon クライアントで読む
 * （ログイン中の管理者・出店者にだけ見える非公開の行が他の来訪者へ漏れないようにする）。
 */

export const SHOP_BASE_CACHE_TAG = "map-shop-base";

/** 差分を取りにいく間隔。これより頻繁にはDBへ問い合わせない */
export const SHOP_DELTA_INTERVAL_MS = 60 * 1000;
/** 全件を読み直す間隔。差分の取りこぼしがあっても、この時間で必ず直る */
export const SHOP_FULL_RELOAD_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** 差分の取得に失敗したときに、次に試すまでの待ち時間（DB が不調のときに毎回叩かない） */
const SHOP_DELTA_RETRY_MS = 15 * 1000;

// 区画・カテゴリーなどは出店者のブラウザからは変わらず、管理画面の API から捨てる合図が届く。
// 合図を取りこぼしても、この秒数までには反映されるようにしておく
const SHOP_SUPPORT_REVALIDATE_SECONDS = 15 * 60;

const getCachedSupportRows = unstable_cache(
  async (): Promise<VendorShopSupportRows> => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    const { rows, failedTables } = await fetchVendorShopSupportRows(supabase);
    // 一部だけ欠けたデータをキャッシュすると、その間ずっと店舗が減って見えるため、
    // 失敗したときは例外にしてキャッシュさせない
    if (failedTables.length > 0) {
      throw new Error(`店舗データの取得に失敗しました: ${failedTables.join(", ")}`);
    }
    return rows;
  },
  // 行の形（取る列）を変えたら版を上げる。古い形のキャッシュを使い回さないため
  ["map-shop-support-rows-v1"],
  { revalidate: SHOP_SUPPORT_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] }
);

// vendors / products の差分更新用の状態。サーバーのインスタンスごとに持つ
let deltaStore: DeltaStore | null = null;
let deltaStoreLoadedAtMs = 0;
let nextDeltaAtMs = 0;
let forceIdCheck = false;
let inflightRefresh: Promise<DeltaStore> | null = null;

async function refreshDeltaStore(supabase: NonNullable<ReturnType<typeof createAnonClient>>): Promise<DeltaStore> {
  const source = createSupabaseDeltaSource(supabase);
  const startedAtMs = Date.now();
  if (!deltaStore || startedAtMs - deltaStoreLoadedAtMs >= SHOP_FULL_RELOAD_INTERVAL_MS) {
    const loaded = await loadFullStore(source, startedAtMs);
    deltaStoreLoadedAtMs = startedAtMs;
    forceIdCheck = false;
    return loaded;
  }
  // 取っている間に管理画面から新しい合図が来たら残るよう、先に下ろしておく（失敗したら戻す）
  const checkIds = forceIdCheck;
  forceIdCheck = false;
  try {
    return await syncStore(source, deltaStore, startedAtMs, { forceIdCheck: checkIds });
  } catch (error) {
    forceIdCheck ||= checkIds;
    throw error;
  }
}

async function getVendorAndProductRows(
  supabase: NonNullable<ReturnType<typeof createAnonClient>>
): Promise<Pick<VendorShopBaseRows, "vendors" | "products">> {
  if (!deltaStore || Date.now() >= nextDeltaAtMs) {
    inflightRefresh ??= refreshDeltaStore(supabase).finally(() => {
      inflightRefresh = null;
    });
    try {
      deltaStore = await inflightRefresh;
      nextDeltaAtMs = Date.now() + SHOP_DELTA_INTERVAL_MS;
    } catch (error) {
      nextDeltaAtMs = Date.now() + SHOP_DELTA_RETRY_MS;
      // 手元に前回までのデータがあれば、それで表示を続ける。無ければ呼び出し側が直接取り直す
      if (!deltaStore) throw error;
      console.warn("[fetchPublicShops] 差分の取得に失敗したため、前回のデータで表示します:", error);
    }
  }
  const { vendors, products } = storeToRows(deltaStore);
  return { vendors, products };
}

async function getBaseRows(
  supabase: NonNullable<ReturnType<typeof createAnonClient>>
): Promise<VendorShopBaseRows> {
  try {
    const [vendorAndProducts, support] = await Promise.all([
      getVendorAndProductRows(supabase),
      getCachedSupportRows(),
    ]);
    return { ...vendorAndProducts, ...support };
  } catch (error) {
    // キャッシュに載せられなかったときは、従来どおり取れた分だけで表示する
    console.warn("[fetchPublicShops] キャッシュを使わずに取得します:", error);
    return (await fetchVendorShopBaseRows(supabase)).rows;
  }
}

/**
 * `locale` が日本語以外のときは、保存済みの訳（shop_translations）を重ねて返す。
 * 訳の無い店・項目は日本語のまま。店の並びや位置は言語によらず同じ。
 */
export async function fetchPublicShops(locale: Locale = DEFAULT_LOCALE): Promise<Shop[]> {
  const supabase = createAnonClient();
  if (!supabase) return [];

  const [baseRows, activeContents] = await Promise.all([
    getBaseRows(supabase),
    fetchActiveContentRows(supabase),
  ]);

  return applyShopTranslations(buildVendorShops(baseRows, activeContents), locale);
}

/**
 * 管理画面の API で店舗・区画・カテゴリーを書き換えたあとに呼ぶ。
 * 店舗の削除などは差分には現れないので、次の問い合わせで店舗の id を突き合わせ直す
 */
export function revalidatePublicShops() {
  revalidateTag(SHOP_BASE_CACHE_TAG, { expire: 0 });
  nextDeltaAtMs = 0;
  forceIdCheck = true;
}
