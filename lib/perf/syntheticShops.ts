/**
 * 計測用の店舗複製
 *
 * 開発環境の DB には店舗が少ないことがあり、そのままでは本番規模（約 300 店舗）の
 * 描画負荷を再現できない。`?perf=1&perfShops=300` のときだけ、既存店舗を
 * ひな型にして道沿いに指定数まで複製する。
 *
 * 通常表示には一切関与しない（呼び出し側がフラグを見て使う）。
 */

export interface SyntheticShopTemplate {
  id: number;
  lat: number;
  lng: number;
  name: string;
}

interface RoutePointLike {
  lat: number;
  lng: number;
}

/** URL から複製数を読む。フラグが無ければ null */
export function readPerfShopCount(search: string): number | null {
  const params = new URLSearchParams(search);
  if (params.get("perf") !== "1") return null;
  const n = Number(params.get("perfShops"));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 2000);
}

/**
 * 道に沿って count 店舗ぶんの座標を作り、ひな型を順番に割り当てる。
 * 道の南北に交互に振り分け、名前と ID は重複しないよう振り直す。
 */
export function synthesizeShops<T extends SyntheticShopTemplate>(
  templates: T[],
  routePoints: RoutePointLike[],
  count: number
): T[] {
  if (templates.length === 0 || routePoints.length < 2 || count <= templates.length) {
    return templates;
  }

  // 道の累積距離（度単位の簡易距離で十分）
  const seg: number[] = [0];
  for (let i = 1; i < routePoints.length; i++) {
    const a = routePoints[i - 1];
    const b = routePoints[i];
    seg.push(seg[i - 1] + Math.hypot(b.lat - a.lat, b.lng - a.lng));
  }
  const total = seg[seg.length - 1];
  if (total === 0) return templates;

  const maxId = templates.reduce((m, s) => Math.max(m, s.id), 0);
  const result: T[] = [];
  const perSide = Math.ceil(count / 2);

  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const slot = Math.floor(i / 2);
    const t = ((slot + 0.5) / perSide) * total;

    // t が属する区間を探す
    let k = 1;
    while (k < seg.length - 1 && seg[k] < t) k++;
    const a = routePoints[k - 1];
    const b = routePoints[k];
    const span = seg[k] - seg[k - 1] || 1;
    const u = (t - seg[k - 1]) / span;
    const lat = a.lat + (b.lat - a.lat) * u;
    const lng = a.lng + (b.lng - a.lng) * u;

    // 道に対する法線方向へ約 12m ずらす（緯度 1 度 ≒ 111km）
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const len = Math.hypot(dx, dy) || 1;
    const offset = 0.00011 * side;
    const nLat = (-dx / len) * offset;
    const nLng = (dy / len) * offset;

    const template = templates[i % templates.length];
    result.push({
      ...template,
      id: maxId + 1 + i,
      lat: lat + nLat,
      lng: lng + nLng,
      name: `${template.name} #${i + 1}`,
    });
  }
  return result;
}
