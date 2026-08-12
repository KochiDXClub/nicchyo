import { ROAD_CONFIG, getRoadCenterlinePoints } from "../config/roadConfig";
import {
  DEFAULT_MAP_ROUTE_CONFIG,
  type MapRouteConfig,
  type MapRoutePoint,
} from "../types/mapRoute";

export type RouteProjection = {
  point: { lat: number; lng: number };
  distanceMeters: number;
  segmentIndex: number;
  t: number;
};

export type RouteSegment = {
  key: string;
  start: MapRoutePoint;
  end: MapRoutePoint;
  isBranch: boolean;
};

export type MapRoutePointRole = "main-start" | "main-middle" | "main-end" | "branch";

export type RouteTopology = {
  normalizedPoints: MapRoutePoint[];
  pointById: Map<string, MapRoutePoint>;
  mainlinePoints: MapRoutePoint[];
  branchChildrenById: Map<string, MapRoutePoint[]>;
  segments: RouteSegment[];
};

export type RouteChain = {
  key: string;
  points: MapRoutePoint[];
};

export function getDefaultMapRoutePoints(): MapRoutePoint[] {
  return getRoadCenterlinePoints().map((point, index) => ({
    id: `default-route-point-${index + 1}`,
    lat: point.lat,
    lng: point.lng,
    order: index,
    branchFromId: null,
  }));
}

export function getDefaultMapRouteConfig(): MapRouteConfig {
  return {
    ...DEFAULT_MAP_ROUTE_CONFIG,
    roadHalfWidthMeters: DEFAULT_MAP_ROUTE_CONFIG.roadHalfWidthMeters,
  };
}

export function normalizeMapRoutePoints(points: MapRoutePoint[]): MapRoutePoint[] {
  return [...points]
    .filter(
      (point) =>
        point &&
        typeof point.id === "string" &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng)
    )
    .map((point) => ({
      ...point,
      branchFromId: point.branchFromId ?? null,
    }))
    .sort((a, b) => {
      const branchRankA = a.branchFromId ? 1 : 0;
      const branchRankB = b.branchFromId ? 1 : 0;
      if (branchRankA !== branchRankB) {
        return branchRankA - branchRankB;
      }
      return a.order - b.order;
    })
    .map((point, index) => ({
      ...point,
      order: index,
    }));
}

export function getMainRoutePoints(points: MapRoutePoint[]): MapRoutePoint[] {
  return normalizeMapRoutePoints(points).filter((point) => !point.branchFromId);
}

export function getBranchRoutePoints(points: MapRoutePoint[]): MapRoutePoint[] {
  return normalizeMapRoutePoints(points).filter((point) => Boolean(point.branchFromId));
}

export function getRouteTopology(points: MapRoutePoint[]): RouteTopology {
  const normalized = normalizeMapRoutePoints(points);
  const mainline = normalized.filter((point) => !point.branchFromId);
  const pointById = new Map(normalized.map((point) => [point.id, point]));
  const branchChildrenById = new Map<string, MapRoutePoint[]>();
  const segments: RouteSegment[] = [];

  for (let index = 0; index < mainline.length - 1; index += 1) {
    segments.push({
      key: `main-${mainline[index].id}-${mainline[index + 1].id}`,
      start: mainline[index],
      end: mainline[index + 1],
      isBranch: false,
    });
  }

  normalized
    .filter((point) => point.branchFromId)
    .forEach((point) => {
      const parent = pointById.get(point.branchFromId ?? "");
      if (!parent) return;
      const children = branchChildrenById.get(parent.id) ?? [];
      children.push(point);
      branchChildrenById.set(parent.id, children);
      segments.push({
        key: `branch-${parent.id}-${point.id}`,
        start: parent,
        end: point,
        isBranch: true,
      });
    });

  return {
    normalizedPoints: normalized,
    pointById,
    mainlinePoints: mainline,
    branchChildrenById,
    segments,
  };
}

export function getRouteSegments(points: MapRoutePoint[]): RouteSegment[] {
  return getRouteTopology(points).segments;
}

export function getRoutePointRole(points: MapRoutePoint[], pointId: string): MapRoutePointRole | null {
  const topology = getRouteTopology(points);
  const point = topology.pointById.get(pointId);
  if (!point) {
    return null;
  }
  if (point.branchFromId) {
    return "branch";
  }
  const mainIndex = topology.mainlinePoints.findIndex((item) => item.id === pointId);
  if (mainIndex < 0) {
    return null;
  }
  if (mainIndex === 0) {
    return "main-start";
  }
  if (mainIndex === topology.mainlinePoints.length - 1) {
    return "main-end";
  }
  return "main-middle";
}

export function getRoutePointStatus(points: MapRoutePoint[], pointId: string): {
  role: MapRoutePointRole;
  label: string;
  description: string;
} | null {
  const topology = getRouteTopology(points);
  const point = topology.pointById.get(pointId);
  const role = getRoutePointRole(points, pointId);
  if (!point || !role) {
    return null;
  }

  if (role === "branch") {
    return {
      role,
      label: "枝点",
      description: `分岐元: ${point.branchFromId}`,
    };
  }

  if (role === "main-start") {
    return {
      role,
      label: "左端",
      description: "幹線の始点です。追加すると左方向へ延長します。",
    };
  }

  if (role === "main-end") {
    return {
      role,
      label: "右端",
      description: "幹線の終点です。追加すると右方向へ延長します。",
    };
  }

  return {
    role,
    label: "幹線の中間点",
    description: "追加すると上側/下側に分岐する新しい道を作れます。",
  };
}

export function getMainRouteNeighbors(
  points: MapRoutePoint[],
  pointId: string
): {
  previous: MapRoutePoint | null;
  current: MapRoutePoint | null;
  next: MapRoutePoint | null;
} {
  const topology = getRouteTopology(points);
  const mainIndex = topology.mainlinePoints.findIndex((point) => point.id === pointId);
  if (mainIndex < 0) {
    return {
      previous: null,
      current: null,
      next: null,
    };
  }

  return {
    previous: topology.mainlinePoints[mainIndex - 1] ?? null,
    current: topology.mainlinePoints[mainIndex] ?? null,
    next: topology.mainlinePoints[mainIndex + 1] ?? null,
  };
}

export function getBranchParent(points: MapRoutePoint[], pointId: string): MapRoutePoint | null {
  const topology = getRouteTopology(points);
  const point = topology.pointById.get(pointId);
  if (!point?.branchFromId) {
    return null;
  }
  return topology.pointById.get(point.branchFromId) ?? null;
}

export function getBranchChildren(points: MapRoutePoint[], pointId: string): MapRoutePoint[] {
  return getRouteTopology(points).branchChildrenById.get(pointId) ?? [];
}

export function getConnectedRouteNeighbors(points: MapRoutePoint[], pointId: string): MapRoutePoint[] {
  const topology = getRouteTopology(points);
  const neighbors: MapRoutePoint[] = [];
  for (const segment of topology.segments) {
    if (segment.start.id === pointId) {
      neighbors.push(segment.end);
    } else if (segment.end.id === pointId) {
      neighbors.push(segment.start);
    }
  }
  return neighbors;
}

export function getRouteChains(points: MapRoutePoint[]): RouteChain[] {
  const topology = getRouteTopology(points);
  const adjacency = new Map<string, Array<{ neighborId: string; segmentKey: string }>>();

  for (const segment of topology.segments) {
    const startEdges = adjacency.get(segment.start.id) ?? [];
    startEdges.push({ neighborId: segment.end.id, segmentKey: segment.key });
    adjacency.set(segment.start.id, startEdges);

    const endEdges = adjacency.get(segment.end.id) ?? [];
    endEdges.push({ neighborId: segment.start.id, segmentKey: segment.key });
    adjacency.set(segment.end.id, endEdges);
  }

  const visitedEdges = new Set<string>();
  const chains: RouteChain[] = [];
  const nodes = topology.normalizedPoints.filter((point) => (adjacency.get(point.id) ?? []).length > 0);
  const startNodes = nodes.filter((point) => (adjacency.get(point.id) ?? []).length !== 2);

  const walkChain = (startId: string, neighborId: string, segmentKey: string): RouteChain | null => {
    if (visitedEdges.has(segmentKey)) {
      return null;
    }

    const chain: MapRoutePoint[] = [];
    let currentId = startId;
    let nextId = neighborId;
    let nextSegmentKey = segmentKey;

    while (true) {
      visitedEdges.add(nextSegmentKey);

      const currentPoint = topology.pointById.get(currentId);
      const nextPoint = topology.pointById.get(nextId);
      if (!currentPoint || !nextPoint) {
        return null;
      }

      if (chain.length === 0) {
        chain.push(currentPoint);
      }
      chain.push(nextPoint);

      const nextEdges = (adjacency.get(nextId) ?? []).filter((edge) => edge.neighborId !== currentId);
      if ((adjacency.get(nextId) ?? []).length !== 2 || nextEdges.length === 0) {
        break;
      }

      const candidate = nextEdges.find((edge) => !visitedEdges.has(edge.segmentKey));
      if (!candidate) {
        break;
      }

      currentId = nextId;
      nextId = candidate.neighborId;
      nextSegmentKey = candidate.segmentKey;
    }

    if (chain.length < 2) {
      return null;
    }

    return {
      key: chain.map((point) => point.id).join("->"),
      points: chain,
    };
  };

  for (const node of startNodes) {
    for (const edge of adjacency.get(node.id) ?? []) {
      const chain = walkChain(node.id, edge.neighborId, edge.segmentKey);
      if (chain) {
        chains.push(chain);
      }
    }
  }

  for (const node of nodes) {
    for (const edge of adjacency.get(node.id) ?? []) {
      const chain = walkChain(node.id, edge.neighborId, edge.segmentKey);
      if (chain) {
        chains.push(chain);
      }
    }
  }

  return chains;
}

export function smoothRoutePath(
  path: Array<[number, number]>,
  iterations = 2
): Array<[number, number]> {
  if (path.length < 3 || iterations <= 0) {
    return path;
  }

  let current = path;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) {
      break;
    }
    const next: Array<[number, number]> = [current[0]];
    for (let index = 0; index < current.length - 1; index += 1) {
      const a = current[index];
      const b = current[index + 1];
      const q: [number, number] = [
        a[0] * 0.75 + b[0] * 0.25,
        a[1] * 0.75 + b[1] * 0.25,
      ];
      const r: [number, number] = [
        a[0] * 0.25 + b[0] * 0.75,
        a[1] * 0.25 + b[1] * 0.75,
      ];
      if (index > 0) {
        next.push(q);
      }
      next.push(r);
    }
    next.push(current[current.length - 1]);
    current = next;
  }

  return current;
}

export function stabilizeRoutePointMove(
  points: MapRoutePoint[],
  pointId: string,
  lat: number,
  lng: number,
  straightAngleThresholdDeg = 10,
  snapBackDistanceMeters = 1.5
): MapRoutePoint[] {
  const moved = normalizeMapRoutePoints(
    points.map((point) => (point.id === pointId ? { ...point, lat, lng } : point))
  );
  const neighbors = getConnectedRouteNeighbors(moved, pointId);
  if (neighbors.length !== 2) {
    return moved;
  }

  const target = moved.find((point) => point.id === pointId);
  if (!target) {
    return moved;
  }

  const a = neighbors[0];
  const b = neighbors[1];
  const angle = getTurnAngleDegrees(a, target, b);
  if (Math.abs(180 - angle) > straightAngleThresholdDeg) {
    return moved;
  }

  const projection = projectPointOntoSegment(target, a, b);
  const distanceFromSegment = distanceMeters(target, projection.point);
  if (distanceFromSegment > snapBackDistanceMeters) {
    return moved;
  }

  return normalizeMapRoutePoints(
    moved.map((point) =>
      point.id === pointId
        ? {
            ...point,
            lat: projection.point.lat,
            lng: projection.point.lng,
          }
        : point
    )
  );
}

export function getEffectiveMapRouteConfig(
  config?: Partial<MapRouteConfig> | null
): MapRouteConfig {
  return {
    ...getDefaultMapRouteConfig(),
    ...(config ?? {}),
    key: config?.key ?? DEFAULT_MAP_ROUTE_CONFIG.key,
  };
}

export function getRouteBounds(
  points: Array<{ lat: number; lng: number }>,
  fallback: [[number, number], [number, number]] = ROAD_CONFIG.bounds
): [[number, number], [number, number]] {
  if (points.length === 0) {
    return fallback;
  }

  let north = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lng);
    west = Math.min(west, point.lng);
  }

  return [
    [north, east],
    [south, west],
  ];
}

export function expandBoundsByMeters(
  bounds: [[number, number], [number, number]],
  paddingMeters: number
): [[number, number], [number, number]] {
  const centerLat = (bounds[0][0] + bounds[1][0]) / 2;
  const latPad = metersToLat(paddingMeters);
  const lngPad = metersToLng(paddingMeters, centerLat);
  return [
    [bounds[0][0] + latPad, bounds[0][1] + lngPad],
    [bounds[1][0] - latPad, bounds[1][1] - lngPad],
  ];
}

export function getRouteCenter(
  points: Array<{ lat: number; lng: number }>,
  fallbackBounds: [[number, number], [number, number]] = ROAD_CONFIG.bounds
): [number, number] {
  const bounds = getRouteBounds(points, fallbackBounds);
  return [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
  ];
}

export function densifyPath(
  points: Array<{ lat: number; lng: number }>,
  stepMeters: number
): Array<[number, number]> {
  if (points.length < 2) {
    return points.map((p) => [p.lat, p.lng]);
  }

  const dense: Array<[number, number]> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dist = distanceMeters(a, b);
    const steps = Math.max(1, Math.ceil(dist / stepMeters));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      dense.push([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]);
    }
  }
  const last = points[points.length - 1];
  dense.push([last.lat, last.lng]);
  return dense;
}

export function smoothPath(path: Array<[number, number]>, radius: number): Array<[number, number]> {
  if (path.length < 3 || radius <= 0) return path;
  return path.map((_, idx) => {
    const start = Math.max(0, idx - radius);
    const end = Math.min(path.length - 1, idx + radius);
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    for (let i = start; i <= end; i += 1) {
      sumLat += path[i][0];
      sumLng += path[i][1];
      count += 1;
    }
    return [sumLat / count, sumLng / count];
  });
}

export function buildRoadPolygon(
  centerline: Array<[number, number]>,
  halfWidthMeters: number
): Array<[number, number]> {
  if (centerline.length < 2) return [];

  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < centerline.length; i += 1) {
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    const curr = centerline[i];
    const tangent = tangentVectorMeters(prev, next, curr[0]);
    const len = Math.hypot(tangent.x, tangent.y) || 1;
    const nx = -tangent.y / len;
    const ny = tangent.x / len;

    const dLat = metersToLat(ny * halfWidthMeters);
    const dLng = metersToLng(nx * halfWidthMeters, curr[0]);
    left.push([curr[0] + dLat, curr[1] + dLng]);
    right.push([curr[0] - dLat, curr[1] - dLng]);
  }

  return [...left, ...right.reverse()];
}

export function projectPointOntoRoute(
  point: { lat: number; lng: number },
  routePoints: MapRoutePoint[]
): RouteProjection | null {
  const segments = getRouteSegments(routePoints);
  return projectPointOntoSegments(point, routePoints, segments);
}

/**
 * 緯度経度から最も近い道の id を求める（区画は road_id を持たず、道の形状への
 * 投影で都度導出するため）。どの道からも snapDistanceMeters 以上離れている
 * 場合は null を返す。マップ編集のサーバー側・クライアント側の両方で同じ
 * 判定ロジックを使うための共通実装（別々に実装すると、保存時にサーバーが
 * 検証する道の割り当てと、エディタが画面に表示する割り当てがズレる恐れがある）。
 */
export function findNearestRoadId(
  point: { lat: number; lng: number },
  roads: { id: string; points: MapRoutePoint[] }[],
  snapDistanceMeters: number
): string | null {
  let bestRoadId: string | null = null;
  let bestDistance = Infinity;

  for (const road of roads) {
    if (road.points.length === 0) continue;
    const projection = projectPointOntoRoute(point, road.points);
    if (projection && projection.distanceMeters < bestDistance) {
      bestDistance = projection.distanceMeters;
      bestRoadId = road.id;
    }
  }

  return bestDistance <= snapDistanceMeters ? bestRoadId : null;
}

export function projectPointOntoSegments(
  point: { lat: number; lng: number },
  routePoints: Array<{ lat: number; lng: number }>,
  segments: RouteSegment[]
): RouteProjection | null {

  if (routePoints.length === 0) {
    return null;
  }

  if (segments.length === 0 && routePoints.length === 1) {
    return {
      point: { lat: routePoints[0].lat, lng: routePoints[0].lng },
      distanceMeters: distanceMeters(point, routePoints[0]),
      segmentIndex: 0,
      t: 0,
    };
  }

  let bestProjection: RouteProjection | null = null;

  for (let i = 0; i < segments.length; i += 1) {
    const projection = projectPointOntoSegment(point, segments[i].start, segments[i].end);
    const nextProjection: RouteProjection = {
      point: projection.point,
      distanceMeters: distanceMeters(point, projection.point),
      segmentIndex: i,
      t: projection.t,
    };

    if (!bestProjection || nextProjection.distanceMeters < bestProjection.distanceMeters) {
      bestProjection = nextProjection;
    }
  }

  return bestProjection;
}

export function getRouteLengthKm(points: Array<{ lat: number; lng: number }>): number {
  if (points.length < 2) {
    const bounds = ROAD_CONFIG.bounds;
    return Math.max(
      Math.abs(bounds[0][0] - bounds[1][0]),
      Math.abs(bounds[0][1] - bounds[1][1])
    ) * 111;
  }

  let meters = 0;
  const routeSegments = getRouteSegments(points as MapRoutePoint[]);
  for (const segment of routeSegments) {
    meters += distanceMeters(segment.start, segment.end);
  }
  return meters / 1000;
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = latToMeters(b.lat - a.lat);
  const dLng = lngToMeters(b.lng - a.lng, (a.lat + b.lat) / 2);
  return Math.hypot(dLat, dLng);
}

export function latToMeters(latDiff: number): number {
  return latDiff * 110540;
}

export function lngToMeters(lngDiff: number, lat: number): number {
  return lngDiff * (111320 * Math.cos((lat * Math.PI) / 180));
}

export function metersToLat(meters: number): number {
  return meters / 110540;
}

export function metersToLng(meters: number, lat: number): number {
  const unit = 111320 * Math.cos((lat * Math.PI) / 180);
  if (Math.abs(unit) < 1e-6) return 0;
  return meters / unit;
}

function tangentVectorMeters(
  prev: [number, number],
  next: [number, number],
  latRef: number
): { x: number; y: number } {
  const dLng = next[1] - prev[1];
  const dLat = next[0] - prev[0];
  return {
    x: lngToMeters(dLng, latRef),
    y: latToMeters(dLat),
  };
}

function projectPointOntoSegment(
  point: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): { point: { lat: number; lng: number }; t: number } {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const abLenSq = abLat * abLat + abLng * abLng;

  if (abLenSq === 0) {
    return {
      point: { lat: a.lat, lng: a.lng },
      t: 0,
    };
  }

  const apLat = point.lat - a.lat;
  const apLng = point.lng - a.lng;
  const rawT = (apLat * abLat + apLng * abLng) / abLenSq;
  const t = Math.max(0, Math.min(1, rawT));

  return {
    point: {
      lat: a.lat + abLat * t,
      lng: a.lng + abLng * t,
    },
    t,
  };
}

function getTurnAngleDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  c: { lat: number; lng: number }
): number {
  const abx = lngToMeters(a.lng - b.lng, (a.lat + b.lat) / 2);
  const aby = latToMeters(a.lat - b.lat);
  const cbx = lngToMeters(c.lng - b.lng, (c.lat + b.lat) / 2);
  const cby = latToMeters(c.lat - b.lat);
  const abLength = Math.hypot(abx, aby);
  const cbLength = Math.hypot(cbx, cby);

  if (abLength === 0 || cbLength === 0) {
    return 180;
  }

  const cosine = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / (abLength * cbLength)));
  return (Math.acos(cosine) * 180) / Math.PI;
}
