/**
 * Road config (single source of truth).
 */

export interface RoadSegment {
  name: string;
  bounds: [[number, number], [number, number]];
  centerLine: number;
}

export interface RoadConfig {
  type: 'placeholder' | 'illustration' | 'custom' | 'curved';
  imagePath?: string;
  bounds: [[number, number], [number, number]];
  opacity?: number;
  zIndex?: number;
  centerLine: number;
  widthOffset: number;
  segments?: RoadSegment[];
}

export const ROAD_CONFIG: RoadConfig = {
  type: 'curved',
  bounds: [
    // 追手筋の実座標（指定2区間）に合わせた範囲
    [33.56231, 133.5433256],
    [33.56047, 133.5336783],
  ],
  // 東西配置では中心緯度を基準線として扱う
  centerLine: 33.5614118,
  widthOffset: 0.0001,
  opacity: 0.9,
  zIndex: 50,
  segments: [
    {
      name: 'F0',
      bounds: [
        [33.5622728, 133.5433256],
        [33.5620328, 133.5429279],
      ],
      centerLine: 33.5621528,
    },
    {
      name: 'F1',
      bounds: [
        [33.5622728, 133.5429279],
        [33.5620328, 133.5423485],
      ],
      centerLine: 33.5621528,
    },
    {
      name: 'F2',
      bounds: [
        [33.5622728, 133.5423485],
        [33.5620328, 133.5417692],
      ],
      centerLine: 33.5621528,
    },
    {
      name: 'F3',
      bounds: [
        [33.5622728, 133.5417692],
        [33.5620328, 133.5411898],
      ],
      centerLine: 33.5621528,
    },
    {
      name: 'D1',
      bounds: [
        [33.5622106, 133.5411898],
        [33.5619706, 133.5401167],
      ],
      centerLine: 33.5620906,
    },
    {
      name: 'D2',
      bounds: [
        [33.5619843, 133.5401167],
        [33.5617443, 133.5390437],
      ],
      centerLine: 33.5618643,
    },
    {
      name: 'D3',
      bounds: [
        [33.5617581, 133.5390437],
        [33.5615181, 133.5379706],
      ],
      centerLine: 33.5616381,
    },
    {
      name: 'D4',
      bounds: [
        [33.5615318, 133.5379706],
        [33.5612918, 133.5368975],
      ],
      centerLine: 33.5614118,
    },
    {
      name: 'D5',
      bounds: [
        [33.5613055, 133.5368975],
        [33.5610655, 133.5358244],
      ],
      centerLine: 33.5611855,
    },
    {
      name: 'D6',
      bounds: [
        [33.5610793, 133.5358244],
        [33.5608393, 133.5347514],
      ],
      centerLine: 33.5609593,
    },
    {
      name: 'D7',
      bounds: [
        [33.5608530, 133.5347514],
        [33.5606130, 133.5336783],
      ],
      centerLine: 33.5607330,
    },
  ],
};

export function getRoadBounds(): [[number, number], [number, number]] {
  return ROAD_CONFIG.bounds;
}

/**
 * 日曜市エリア全体の範囲（位置判定用）
 * - 高知城前（西端）からスタート地点（東端）までをカバー
 * - UserLocationMarker と timeBadgeService で共通使用
 */
export const SUNDAY_MARKET_LOCATION_BOUNDS = {
  north: 33.5625,   // 実測データに基づく北端
  south: 33.5600,   // 実測データに基づく南端
  west: 133.5335,   // 高知城前（西端）
  east: 133.5430,   // スタート地点（東端）
} as const;

/**
 * 座標が日曜市エリア内かどうかを判定
 */
export function isInsideSundayMarket(lat: number, lng: number): boolean {
  return (
    lat >= SUNDAY_MARKET_LOCATION_BOUNDS.south &&
    lat <= SUNDAY_MARKET_LOCATION_BOUNDS.north &&
    lng >= SUNDAY_MARKET_LOCATION_BOUNDS.west &&
    lng <= SUNDAY_MARKET_LOCATION_BOUNDS.east
  );
}

export function getRoadCenterLine(): number {
  const bounds = ROAD_CONFIG.bounds;
  const latSpan = Math.abs(bounds[0][0] - bounds[1][0]);
  const lngSpan = Math.abs(bounds[0][1] - bounds[1][1]);
  if (lngSpan > latSpan) {
    return (bounds[0][0] + bounds[1][0]) / 2;
  }
  return (bounds[0][1] + bounds[1][1]) / 2;
}

export function getRoadWidthOffset(useDynamic: boolean = false): number {
  if (!useDynamic) {
    return ROAD_CONFIG.widthOffset;
  }

  const latDiff = Math.abs(ROAD_CONFIG.bounds[0][0] - ROAD_CONFIG.bounds[1][0]);
  const lngDiff = Math.abs(ROAD_CONFIG.bounds[0][1] - ROAD_CONFIG.bounds[1][1]);
  const roadLengthDegrees = Math.max(latDiff, lngDiff);
  const ratio = 0.038;
  return roadLengthDegrees * ratio;
}

export function getRoadLength(): number {
  const [start, end] = ROAD_CONFIG.bounds;
  const latDiff = Math.abs(start[0] - end[0]);
  const lngDiff = Math.abs(start[1] - end[1]);
  return Math.max(latDiff, lngDiff) * 111;
}

export function getSundayMarketBounds(): [[number, number], [number, number]] {
  // NOTE: This expands beyond the Sunday market shop-only span for map panning.
  // Keep the shop-only bounds below for reference/data usage.
  // Shop-only bounds (road span):
  // [
  //   [33.56500, 133.53200],
  //   [33.55330, 133.53000],
  // ]
  return getExpandedRoadBounds({
    north: 0.0055,
    south: 0.003,
    west: 0.003,
    east: 0.0065,
  });
}

export function getRecommendedZoomBounds(): { min: number; max: number } {
  return { min: 15, max: 21 };
}

export function getPaddedRoadBounds(
  paddingRatio: number = 0.05
): [[number, number], [number, number]] {
  const bounds = ROAD_CONFIG.bounds;
  const latRange = Math.abs(bounds[0][0] - bounds[1][0]);
  const lngRange = Math.abs(bounds[0][1] - bounds[1][1]);
  const marginLat = latRange * paddingRatio;
  const marginLng = lngRange * paddingRatio;
  return [
    [bounds[0][0] + marginLat, bounds[0][1] + marginLng],
    [bounds[1][0] - marginLat, bounds[1][1] - marginLng],
  ];
}

export function getExpandedRoadBounds({
  north,
  south,
  west,
  east,
}: {
  north: number;
  south: number;
  west: number;
  east: number;
}): [[number, number], [number, number]] {
  const bounds = ROAD_CONFIG.bounds;
  const northLat = Math.max(bounds[0][0], bounds[1][0]) + north;
  const southLat = Math.min(bounds[0][0], bounds[1][0]) - south;
  const westLng = Math.min(bounds[0][1], bounds[1][1]) - west;
  const eastLng = Math.max(bounds[0][1], bounds[1][1]) + east;
  return [
    [northLat, eastLng],
    [southLat, westLng],
  ];
}

type RoadPoint = { lat: number; lng: number };

export function getRoadCenterlinePoints(): RoadPoint[] {
  if (!ROAD_CONFIG.segments || ROAD_CONFIG.segments.length === 0) {
    const centerLat = (ROAD_CONFIG.bounds[0][0] + ROAD_CONFIG.bounds[1][0]) / 2;
    const centerLng = (ROAD_CONFIG.bounds[0][1] + ROAD_CONFIG.bounds[1][1]) / 2;
    return [{ lat: centerLat, lng: centerLng }];
  }

  const latSpan = Math.abs(ROAD_CONFIG.bounds[0][0] - ROAD_CONFIG.bounds[1][0]);
  const lngSpan = Math.abs(ROAD_CONFIG.bounds[0][1] - ROAD_CONFIG.bounds[1][1]);
  const isEastWest = lngSpan > latSpan;

  return ROAD_CONFIG.segments
    .map((segment) => {
      const northLat = Math.max(segment.bounds[0][0], segment.bounds[1][0]);
      const southLat = Math.min(segment.bounds[0][0], segment.bounds[1][0]);
      const eastLng = Math.max(segment.bounds[0][1], segment.bounds[1][1]);
      const westLng = Math.min(segment.bounds[0][1], segment.bounds[1][1]);

      if (isEastWest) {
        return {
          lat: segment.centerLine ?? (northLat + southLat) / 2,
          lng: (eastLng + westLng) / 2,
        };
      }

      return {
        lat: (northLat + southLat) / 2,
        lng: segment.centerLine ?? (eastLng + westLng) / 2,
      };
    })
    .sort((a, b) => (isEastWest ? a.lng - b.lng : b.lat - a.lat));
}

export function getNearestPointOnRoad(lat: number, lng: number): RoadPoint {
  const points = getRoadCenterlinePoints();
  if (points.length === 0) {
    return { lat, lng };
  }
  if (points.length === 1) {
    return points[0];
  }

  const target = { lat, lng };
  let bestPoint = points[0];
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length - 1; i += 1) {
    const candidate = projectPointOntoSegment(target, points[i], points[i + 1]);
    const distanceSq =
      (candidate.lat - target.lat) * (candidate.lat - target.lat) +
      (candidate.lng - target.lng) * (candidate.lng - target.lng);

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

/** 道の中心線から見た店舗の側。追手筋は東西に伸びるため北側／南側になる */
export type RoadSide = 'north' | 'south';

/**
 * 店舗が道の中心線から見て北側か南側かを判定する。
 *
 * 店舗データに side フィールドは無いため、緯度と道の中心線の比較で導出する。
 * マーカーの木札やバッジを左右・上下に振り分けて、隣接する店どうしの
 * 重なりを減らすために使う。
 *
 * 中心線上ちょうど（境界）の場合は north 側に倒す。
 */
export function getRoadSide(lat: number, lng: number): RoadSide {
  const nearest = getNearestPointOnRoad(lat, lng);
  return lat >= nearest.lat ? 'north' : 'south';
}

function projectPointOntoSegment(point: RoadPoint, a: RoadPoint, b: RoadPoint): RoadPoint {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const abLenSq = abLat * abLat + abLng * abLng;

  if (abLenSq === 0) {
    return a;
  }

  const apLat = point.lat - a.lat;
  const apLng = point.lng - a.lng;
  const rawT = (apLat * abLat + apLng * abLng) / abLenSq;
  const t = Math.max(0, Math.min(1, rawT));

  return {
    lat: a.lat + abLat * t,
    lng: a.lng + abLng * t,
  };
}
