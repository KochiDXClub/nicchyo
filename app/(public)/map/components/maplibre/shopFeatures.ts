/**
 * 店舗レイヤー（GeoJSON ソース）に載せるデータの組み立て。
 *
 * 属性は 2 種類ある:
 * - 店舗リストが変わらない限り同じもの（屋台の見た目・道のどちら側か・写真の URL など）
 * - 検索 / AI / 選択・お気に入りで変わるもの（state・favorite）
 *
 * 以前は状態が 1 店変わるだけで全店分を組み立て直し、setData でソースごと差し替えていた。
 * そうすると MapLibre は全タイルを作り直す。前者は店舗リストごとに 1 回だけ作り、
 * 後者は変わった店だけを updateData の差分で送る（その店を含むタイルだけが作り直される）。
 */
import type { GeoJSONSourceDiff } from "maplibre-gl";
import type { Shop } from "../../data/shops";
import { getRoadSide } from "../../config/roadConfig";
import { resolveStallColors } from "../../config/shopCategories";
import { sanitizeCssColor } from "../../utils/markerHtmlGenerator";
import { getShopThumbnailImage } from "../../../../../lib/shopImages";
import { stallSpriteKey, type StallState } from "./stallSprites";

export type ShopStateMap = Map<number, StallState>;

/** GeoJSON に載せる店舗ごとの表示状態（状態色・お気に入り） */
export interface ShopDisplayState {
  states: ShopStateMap;
  favorites: Set<number>;
}

export type ShopFeature = GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>> & { id: number };

/** 表示状態で変わらない部分だけの Feature。店舗リストごとに 1 回作る */
export function buildShopFeatures(shops: Shop[]): ShopFeature[] {
  return shops
    .filter((s) => !s.illustration?.customSvg)
    .map((s) => {
      const stall = resolveStallColors(s.category, sanitizeCssColor(s.illustration?.color));
      return {
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          spriteKey: stallSpriteKey(s),
          // 道の北側は木札を右（道の外側）、南側は左に出す（Leaflet 版 .shop-side-*）
          side: getRoadSide(s.lat, s.lng),
          // 屋根の上の丸窓。写真が無ければカテゴリの既定画像（軽量なサムネイルを優先）
          photo: getShopThumbnailImage(s),
          photoBorder: stall.dark,
        },
      };
    });
}

function displayOf(id: number, display: ShopDisplayState): { state: StallState; favorite: boolean } {
  return { state: display.states.get(id) ?? "normal", favorite: display.favorites.has(id) };
}

/** ソースを丸ごと作るとき（初回・店舗リストが変わったとき）の FeatureCollection */
export function shopsToGeoJSON(
  features: ShopFeature[],
  display: ShopDisplayState
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      ...f,
      properties: { ...f.properties, ...displayOf(f.id, display) },
    })),
  };
}

/** 前回ソースに反映した状態から、state / favorite が変わった店だけの差分 */
export function diffShopDisplay(
  features: ShopFeature[],
  prev: ShopDisplayState,
  next: ShopDisplayState
): NonNullable<GeoJSONSourceDiff["update"]> {
  const update: NonNullable<GeoJSONSourceDiff["update"]> = [];
  for (const { id } of features) {
    const before = displayOf(id, prev);
    const after = displayOf(id, next);
    if (before.state === after.state && before.favorite === after.favorite) continue;
    update.push({
      id,
      addOrUpdateProperties: [
        { key: "state", value: after.state },
        { key: "favorite", value: after.favorite },
      ],
    });
  }
  return update;
}
