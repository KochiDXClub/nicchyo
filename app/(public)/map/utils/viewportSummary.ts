/**
 * viewportSummary
 *
 * 「このへん、なにがある？」の決定論的な即時応答を作るユーティリティ。
 * LLM を介さず、現在の表示範囲（画面中央80%の長方形）にある店舗を
 * 丁目・ジャンル別に集計する（show, then ask の "show" 部分）。
 *
 * 【設計メモ】
 * - マップは CSS でシェルごと回転しているため、Leaflet の getBounds() は
 *   画面より大きなシェル全体の範囲を返してしまう。そこで店舗をコンテナ
 *   座標に変換し、シェルの回転角を打ち消して「画面上の長方形」に
 *   含まれるかで判定する（isPointInRotatedRect）。
 * - shopIds はすべて中心から近い順。SearchResultsSheet などにそのまま
 *   渡せば「空間で答える」並び順になる。
 */

const CHOME_ORDER = [
  '一丁目',
  '二丁目',
  '三丁目',
  '四丁目',
  '五丁目',
  '六丁目',
  '七丁目',
] as const;

const FALLBACK_CATEGORY = 'その他';

export type NearbyShopLike = {
  id: number;
  lat: number;
  lng: number;
  category?: string;
  chome?: string;
};

export type NearbyGenreSummary = {
  category: string;
  count: number;
  /** 中心から近い順の店舗ID */
  shopIds: number[];
};

export type NearbyViewportSummary = {
  totalCount: number;
  /** 表示範囲に含まれる丁目（一丁目→七丁目の順） */
  chomeLabels: string[];
  /** 店舗数の多い順のジャンル内訳 */
  genres: NearbyGenreSummary[];
  /** 中心から近い順の全店舗ID */
  shopIds: number[];
};

export type RotatedRect = {
  /** 長方形の中心（マップコンテナ座標） */
  center: { x: number; y: number };
  halfWidth: number;
  halfHeight: number;
  /** コンテナに適用されている CSS 回転角（ラジアン） */
  rotationRad: number;
};

/**
 * CSS transform（computed style の matrix 表記）から回転角を取り出す
 *
 * translate は tx/ty 成分にしか影響しないため、matrix(a, b, ...) の
 * a=cosθ, b=sinθ から回転角を復元できる。
 */
export function parseCssRotationRad(
  transform: string | null | undefined
): number {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/matrix\(\s*([^,]+),\s*([^,]+)/);
  if (!match) return 0;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.atan2(b, a);
}

/**
 * 回転したコンテナ内の点が「画面上の軸並行な長方形」に含まれるか
 *
 * コンテナ座標の点を CSS rotate(θ) 適用後の画面座標に変換してから
 * 軸並行判定する（画面座標は y 下向き・正の角度は時計回り）。
 */
export function isPointInRotatedRect(
  point: { x: number; y: number },
  rect: RotatedRect
): boolean {
  const dx = point.x - rect.center.x;
  const dy = point.y - rect.center.y;
  const cos = Math.cos(rect.rotationRad);
  const sin = Math.sin(rect.rotationRad);
  const screenX = dx * cos - dy * sin;
  const screenY = dx * sin + dy * cos;
  return (
    Math.abs(screenX) <= rect.halfWidth && Math.abs(screenY) <= rect.halfHeight
  );
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * 対象範囲（contains 判定）にある店舗を丁目・ジャンル別に集計する
 *
 * @param center 並び順（近い順）の基準となるマップ中心
 * @param contains 店舗が「このへん」の範囲内かを返す判定関数
 */
export function summarizeNearbyShops(
  shops: NearbyShopLike[],
  center: { lat: number; lng: number },
  contains: (point: { lat: number; lng: number }) => boolean
): NearbyViewportSummary {
  const inRange = shops
    .filter((shop) => contains(shop))
    .map((shop) => ({ shop, distance: distanceMeters(center, shop) }))
    .sort((a, b) => a.distance - b.distance);

  const chomeSet = new Set<string>();
  const genreShopIds = new Map<string, number[]>();
  const shopIds: number[] = [];

  for (const { shop } of inRange) {
    shopIds.push(shop.id);
    if (shop.chome) {
      chomeSet.add(shop.chome);
    }
    const category = shop.category?.trim() || FALLBACK_CATEGORY;
    const ids = genreShopIds.get(category);
    if (ids) {
      ids.push(shop.id);
    } else {
      genreShopIds.set(category, [shop.id]);
    }
  }

  const genres: NearbyGenreSummary[] = Array.from(genreShopIds.entries())
    .map(([category, ids]) => ({
      category,
      count: ids.length,
      shopIds: ids,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCount: inRange.length,
    chomeLabels: CHOME_ORDER.filter((chome) => chomeSet.has(chome)),
    genres,
    shopIds,
  };
}

/**
 * 「このへん」パネルに遅れてフェードインする"AIの一言"を組み立てる
 *
 * 【暫定実装】要約データからテンプレートで決定論的に生成する
 * （ハルシネーションゼロ・待ち時間ゼロ）。将来は丁目ごとの事前紹介文
 * や LLM 生成に差し替える想定。
 */
export function buildNearbyNote(summary: NearbyViewportSummary): string {
  if (summary.totalCount === 0) {
    return 'このへんはお店が見当たらんねぇ。道沿いに動かしてみてや。';
  }
  const [top, second] = summary.genres;
  // 毎回同じ言い回しにならないよう、店舗数から決定論的にバリエーションを選ぶ
  if (!second) {
    const singleGenreNotes = [
      `このへんは${top.category}のお店が並ぶあたりやき、ゆっくり見ていってや。`,
      `${top.category}が好きなら当たりのあたりよ。端から順に覗いてみてや。`,
    ];
    return singleGenreNotes[summary.totalCount % singleGenreNotes.length];
  }
  const multiGenreNotes = [
    `このへんは${top.category}のお店が多うて、${second.category}も見つかるき、気になるお店から覗いてみてや。`,
    `${top.category}を探しゆうなら、ええあたりに来ちゅうよ。${second.category}のお店もあるき、見比べてみてや。`,
  ];
  return multiGenreNotes[summary.totalCount % multiGenreNotes.length];
}
