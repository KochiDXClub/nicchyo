import { fetchCategories } from "@/lib/categories/server";
import { withCategory } from "@/lib/categories/catalog";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anonClient";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { readPublicScheduleRollout } from "@/lib/market-schedule/rollout.server";
import { readPublicScheduleData } from "@/lib/market-schedule/read.server";
import { publicAssignmentsForDate, publicVendorStatuses } from "@/lib/market-schedule/publicAssignments";
import { nextSundayJstString } from "@/lib/time/jstDate";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Shop, ShopProfile } from "../types/shopData";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { applyShopTranslations } from "@/lib/i18n/shopTranslation.server";
import {
  applyShopDelta,
  buildVendorShops,
  buildVendorProfiles,
  fetchActiveContentRows,
  fetchShopDelta,
  fetchVendorShopBaseRows,
  fetchVisibleVendorIds,
  pruneInvisibleVendors,
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

// 店舗数が合わないときだけ使う。店舗の id 一覧は差分より大きいので、短い間隔でも共有して取る回数を抑える
const getCachedVisibleVendorIds = unstable_cache(
  async () => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    return fetchVisibleVendorIds(supabase);
  },
  ["map-visible-vendor-ids-v1"],
  { revalidate: SHOP_DELTA_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] }
);

// 予定は管理者の保存時に無効化する。休市情報は別途最新のものを取得する。
const getCachedPublicSchedule = unstable_cache(
  async () => {
    const admin = createAdminClient() as unknown as SupabaseClient | null;
    if (!admin) throw new Error("公開予定を取得できません");
    return readPublicScheduleData(admin);
  },
  ["public-schedule-input-v1"],
  { revalidate: SHOP_DELTA_REVALIDATE_SECONDS, tags: [SHOP_BASE_CACHE_TAG] },
);

/**
 * `locale` が日本語以外のときは、保存済みの訳（shop_translations）を重ねて返す。
 * 訳の無い店・項目は日本語のまま。店の並びや位置は言語によらず同じ。
 */
export async function fetchPublicShopData(locale: Locale = DEFAULT_LOCALE): Promise<{ shops: Shop[]; profiles: ShopProfile[] }> {
  const supabase = createAnonClient();
  if (!supabase) return { shops: [], profiles: [] };

  const [snapshot, activeContents, scheduleEnabled] = await Promise.all([
    getCachedShopBaseRows().catch(async (error: unknown): Promise<{ rows: VendorShopBaseRows; snapshotAt: string | null }> => {
      // キャッシュに載せられなかったときは、従来どおり取れた分だけで表示する(取り立てなので差分は要らない)
      console.warn("[fetchPublicShops] キャッシュを使わずに取得します:", error);
      return { rows: (await fetchVendorShopBaseRows(supabase)).rows, snapshotAt: null };
    }),
    fetchActiveContentRows(supabase),
    readPublicScheduleRollout(),
  ]);

  let baseRows = snapshot.rows;
  if (snapshot.snapshotAt) {
    try {
      const since = new Date(Date.parse(snapshot.snapshotAt) - SHOP_DELTA_MARGIN_MS).toISOString();
      const delta = await getCachedShopDelta(since);
      baseRows = applyShopDelta(baseRows, delta);
      // 許可の取り消し・店舗の削除は差分に現れない。見える店舗の数が合わなければ、id で突き合わせて外す
      if (delta.visibleVendorCount !== baseRows.vendors.length) {
        baseRows = pruneInvisibleVendors(baseRows, new Set(await getCachedVisibleVendorIds()));
      }
    } catch (error) {
      // 差分が取れなくても、キャッシュしたデータで表示を続ける(反映が遅れるだけ)
      console.warn("[fetchPublicShops] 変わった行の取得に失敗しました。キャッシュのまま表示します:", error);
    }
  }

  let ids = new Map<string, number>();
  let statuses = new Map<string, NonNullable<ShopProfile["nextMarketStatus"]>>();
  let marketDate: string | null = null;
  if (scheduleEnabled) {
    const admin = createAdminClient() as unknown as SupabaseClient | null;
    if (!admin) throw new Error("公開予定を取得できません");
    const date = nextSundayJstString();
    marketDate = date;
    const [schedule, identities, marketDay] = await Promise.all([
      getCachedPublicSchedule(),
      fetchAllRows<{ id: string; public_shop_id: number }>(
        (from, to) => supabase.from("vendors").select("id,public_shop_id").order("id").range(from, to),
        { label: "public vendor identities" }
      ),
      admin.from("market_days").select("market_date,status").eq("market_date", date).maybeSingle(),
    ]);
    if (identities.error) throw new Error("公開店舗の識別子を取得できません");
    if (marketDay.error) throw new Error("日曜市の開催状況を取得できません");
    ids = new Map((identities.data ?? []).filter((row) => Number.isSafeInteger(row.public_shop_id) && row.public_shop_id >= 1000 && row.public_shop_id <= 2147483647).map((row) => [row.id, row.public_shop_id]));
    const visible = new Set(ids.keys());
    const scheduleWithDay = { ...schedule, marketDays: marketDay.data ? [marketDay.data] : [] };
    statuses = publicVendorStatuses(scheduleWithDay, date, [...visible]);
    const members = new Set(schedule.memberships.map((member) => member.vendor_id));
    baseRows = {
      ...baseRows,
      vendors: baseRows.vendors.flatMap((vendor) => {
        const publicId = ids.get(vendor.id);
        return typeof publicId === "number" ? [{ ...vendor, public_shop_id: publicId }] : [];
      }),
      assignments: publicAssignmentsForDate(scheduleWithDay, date, baseRows.assignments, visible).filter((row) => row.vendor_id !== null && (statuses.get(row.vendor_id) === "scheduled" || (!members.has(row.vendor_id) && row.market_date === date))),
    };
  }
  const categories = await fetchCategories().catch(() => []);
  const positioned = (scheduleEnabled ? buildVendorShops(baseRows, activeContents, { stableIds: true }) : buildVendorShops(baseRows, activeContents)).map(shop => withCategory(shop, categories));
  if (!scheduleEnabled) {
    const shops = await applyShopTranslations(positioned, locale);
    return { shops, profiles: shops };
  }
  const mappedIds = new Set(positioned.map((shop) => shop.id));
  const profiles = buildVendorProfiles(baseRows, activeContents, ids).map((profile) => {
    const status = mappedIds.has(profile.id) ? "scheduled" : statuses.get(profile.vendorId ?? "") ?? "unknown";
    return withCategory({ ...profile, nextMarketStatus: status, hasMapLocation: mappedIds.has(profile.id), assignmentMarketDate: status === "scheduled" ? marketDate : null }, categories);
  });
  const translated = await applyShopTranslations(profiles, locale);
  const byId = new Map(translated.map((profile) => [profile.id, profile]));
  const shops = positioned.flatMap((shop) => {
    const profile = byId.get(shop.id);
    return profile ? [{ ...shop, ...profile }] : [];
  });
  return { shops, profiles: translated };
}

export async function fetchPublicShops(locale: Locale = DEFAULT_LOCALE): Promise<Shop[]> {
  return (await fetchPublicShopData(locale)).shops;
}

export async function fetchPublicShopProfiles(locale: Locale = DEFAULT_LOCALE): Promise<ShopProfile[]> {
  return (await fetchPublicShopData(locale)).profiles;
}

/** 管理画面の API で店舗・区画・カテゴリーを書き換えたあとに呼ぶ */
export function revalidatePublicShops() {
  revalidateTag(SHOP_BASE_CACHE_TAG, { expire: 0 });
}
