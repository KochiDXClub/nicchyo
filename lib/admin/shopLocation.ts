/**
 * 運営が現地で店舗の位置（店番と座標）を登録するときの入力の検証（PUT /api/admin/shops/[id]/location）。
 *
 * 店番は MIN_SHOP_ID〜MAX_SHOP_ID（lib/shops/route.ts。1〜999）。座標は日曜市のある高知市中心部の
 * 範囲に限る。スマホの現在地が大きくずれたとき（屋内・電波が悪いとき）に、遠くの座標を保存してしまわないため。
 */
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";

/** 高知市中心部（日曜市の道の周り）。この外の座標は、取り違えとして断る */
export const FIELD_BOUNDS = { minLat: 33.54, maxLat: 33.58, minLng: 133.52, maxLng: 133.56 } as const;

/** 店番は、住所録に無い新しい店舗など、まだ決まっていないときは null */
/** 位置の取り方。gps=スマホの現在地、pin=地図で指した位置 */
export type LocationSource = "gps" | "pin";

export type ShopLocationInput = {
  storeNumber: number | null;
  lat: number;
  lng: number;
  source: LocationSource;
  /** GPS の誤差（m）。分からない・ピンのときは null */
  accuracyM: number | null;
};

export type ShopLocationResult = { ok: true; value: ShopLocationInput } | { ok: false; error: string };

export function parseShopLocation(body: unknown): ShopLocationResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "リクエストの形が正しくありません" };
  const { storeNumber, lat, lng, source, accuracyM } = body as Record<string, unknown>;

  const hasStoreNumber = storeNumber !== undefined && storeNumber !== null;
  if (hasStoreNumber && (!Number.isInteger(storeNumber) || (storeNumber as number) < MIN_SHOP_ID || (storeNumber as number) > MAX_SHOP_ID)) {
    return { ok: false, error: `店番は${MIN_SHOP_ID}〜${MAX_SHOP_ID}の整数で入力してください` };
  }
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "位置が正しくありません" };
  }
  if (lat < FIELD_BOUNDS.minLat || lat > FIELD_BOUNDS.maxLat || lng < FIELD_BOUNDS.minLng || lng > FIELD_BOUNDS.maxLng) {
    return { ok: false, error: "日曜市の範囲の外です。地図で位置を確かめてください" };
  }
  if (source !== undefined && source !== "gps" && source !== "pin") return { ok: false, error: "位置の取り方が正しくありません" };
  if (accuracyM !== undefined && accuracyM !== null && (typeof accuracyM !== "number" || !Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100_000)) {
    return { ok: false, error: "誤差が正しくありません" };
  }
  return {
    ok: true,
    value: {
      storeNumber: hasStoreNumber ? (storeNumber as number) : null,
      lat,
      lng,
      source: source === "gps" ? "gps" : "pin",
      // 誤差が意味を持つのは GPS のときだけ
      accuracyM: source === "gps" && typeof accuracyM === "number" ? Math.round(accuracyM * 10) / 10 : null,
    },
  };
}
