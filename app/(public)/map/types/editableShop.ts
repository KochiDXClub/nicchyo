import type { RoadSide } from "@/lib/map/roadSlotPosition";

/**
 * マップ編集画面（/admin/map-edit）で扱う区画の編集用データ型。
 * サーバー側（app/api/admin/map-layout/_shared.ts）とクライアント側
 * （app/(public)/map-edit/v3/types.ts）の両方から参照する共通定義。
 */
export type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
  chome?: string;
  /**
   * 道基準の位置（market_locations.road_*）。4つとも入っているか、どれも無いかのどちらか。
   * 入っている区画の lat/lng は道の形から計算した値で、道の形を直すとついてくる。
   * 無い区画（移行前の区画）は lat/lng がそのまま位置になる。
   */
  roadId?: string;
  roadDistanceM?: number;
  roadSide?: RoadSide;
  roadOffsetM?: number;
  /**
   * 日曜市の住所録の番号（「123-4」の 123 が本番号、4 が枝番）。公開ページの URL・QR に使う
   * 店番（position）とは別。CSV 取り込みはこの組で区画を探す。無い区画（移行前・手で作った区画）もある
   */
  officialNumber?: number;
  branchNumber?: number;
};

/** 区画の表示用の番号。住所録の番号（123-4）があればそれ、無ければ店番 */
export function slotLabel(shop: Pick<EditableShop, "position" | "officialNumber" | "branchNumber">): string {
  if (shop.officialNumber == null) return String(shop.position);
  return shop.branchNumber != null ? `${shop.officialNumber}-${shop.branchNumber}` : String(shop.officialNumber);
}

/**
 * 丁目の表示順・許容値の一覧。サーバー側（_shared.ts の normalizeChome）と
 * クライアント側（v3/types.ts, RoadLaneView.tsx）の両方が同じ並び・値を
 * 参照できるよう、ここに1本化する（別々に持つと丁目の増減時に片方だけ
 * 更新し忘れ、区画情報が黙って落ちる恐れがあるため）。
 */
export const CHOME_ORDER = ["一丁目", "二丁目", "三丁目", "四丁目", "五丁目", "六丁目", "七丁目"] as const;

/**
 * 西から東へたどる丁目の順（六→七→五→…→一）。六丁目が西（高知城前）、一丁目が東（はりまや橋側）。
 * 七丁目は追手筋ではなく、六丁目と五丁目の間で交差する大橋通り沿いに並ぶ。
 */
export const CHOME_WEST_TO_EAST = ["六丁目", "七丁目", "五丁目", "四丁目", "三丁目", "二丁目", "一丁目"] as const;

/**
 * マップ編集画面で扱う出店者（vendors の一部の列）。区画とは別に保存し、区画は
 * 出店者の id だけを持つ（location_assignments）。区画を動かしたり作り直したりしても
 * 出店者の情報は消えない。
 * 空き区画から新しく登録した出店者は、保存するまで id が NEW_VENDOR_ID_PREFIX で始まる仮 id。
 */
export type EditableVendor = {
  id: string;
  /** 店名（vendors.shop_name） */
  name: string;
  /** ジャンル（vendors.category_id） */
  categoryId: string | null;
  /** こだわり・説明（vendors.strength） */
  strength: string;
  /** 主な商品（vendors.main_products） */
  mainProducts: string[];
};

export const NEW_VENDOR_ID_PREFIX = "new-vendor-";

export type VendorCategory = { id: string; name: string };

/** 出店者の入力値の上限（画面とサーバーの両方で同じ値を使う） */
export const VENDOR_FIELD_LIMITS = {
  nameMaxLength: 60,
  strengthMaxLength: 400,
  mainProductsMaxCount: 10,
  mainProductMaxLength: 40,
} as const;
