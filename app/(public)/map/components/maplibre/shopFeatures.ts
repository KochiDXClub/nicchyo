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

export type ShopFeature = GeoJSON.Feature<GeoJSON.Point, { id: number } & Record<string, unknown>> & { id: string | number };

/** 表示状態で変わらない部分だけの Feature。店舗リストごとに 1 回作る */
export function buildShopFeatures(shops: Shop[]): ShopFeature[] {
  return shops.flatMap((shop) => {
    const stall = resolveStallColors(shop.categoryKey ?? shop.category, sanitizeCssColor(shop.illustration?.color));
    const properties = {
      id: shop.id,
      name: shop.name,
      spriteKey: stallSpriteKey(shop),
      photo: getShopThumbnailImage(shop),
      photoBorder: stall.dark,
    };
    const toFeature = (
      location: Pick<Shop, "lat" | "lng" | "roadSide">,
      id: ShopFeature["id"],
      marketId?: string,
    ): ShopFeature => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [location.lng, location.lat] },
      properties: { ...properties, marketId, placementId: id, side: location.roadSide ?? getRoadSide(location.lat, location.lng) },
    });
    return [
      toFeature(shop, shop.id),
      ...(shop.otherMarketLocations ?? []).map((location) => toFeature(location, `${shop.id}:${location.marketId}`, location.marketId)),
    ];
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
      properties: { ...f.properties, ...displayOf(f.properties.id, display) },
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
  for (const { id, properties } of features) {
    const before = displayOf(properties.id, prev);
    const after = displayOf(properties.id, next);
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
