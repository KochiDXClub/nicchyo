/**
 * 起点 → 目的地 の経路を求める
 *
 *   1. 起点・目的地をいちばん近い道へつなぐ（attachPoint。道の外を歩くのはこの区間だけ）
 *   2. ダイクストラで最短路を出す。道の上を必ず通る
 *   3. 道がつながっていない（離れ小島）ときだけ、直線の目安に落とす
 *   4. 折れ線からステップ案内を作る
 */

import { distanceInMeters } from '@/lib/facilities/geo';
import { DETOUR_RATIO, estimateWalkMinutes } from '@/lib/facilities/nearest';
import { shortestPath } from './dijkstra';
import { attachPoint, cloneNetwork } from './network';
import { buildRouteSteps, type RouteLeg } from './steps';
import type { GuideNetwork, GuideRoute, LatLng } from './types';

export type FindRouteOptions = {
  originLabel?: string;
  destinationName: string;
};

function dedupe(points: LatLng[]): LatLng[] {
  return points.filter((point, index) => index === 0 || distanceInMeters(points[index - 1], point) >= 1);
}

function straightRoute(origin: LatLng, destination: LatLng, options: FindRouteOptions): GuideRoute {
  const distanceMeters = distanceInMeters(origin, destination) * DETOUR_RATIO;
  const legs: RouteLeg[] = [{ from: origin, to: destination, pathName: null }];
  return {
    points: dedupe([origin, destination]),
    distanceMeters,
    walkMinutes: estimateWalkMinutes(distanceMeters),
    steps: buildRouteSteps(legs, options),
    viaNetwork: false,
    approximate: true,
  };
}

export function findGuideRoute(
  origin: LatLng,
  destination: LatLng,
  network: GuideNetwork | null,
  options: FindRouteOptions
): GuideRoute {
  if (!network || network.paths.length === 0) return straightRoute(origin, destination, options);

  const work = cloneNetwork(network);
  const originId = attachPoint(work, origin);
  const destinationId = attachPoint(work, destination);
  const result = shortestPath(work, originId, destinationId);
  if (!result) return straightRoute(origin, destination, options);

  const pathById = new Map(work.paths.map((path) => [path.id, path]));
  const rawPoints = result.nodeIds.map((id) => work.nodes[id].point);
  const legs: RouteLeg[] = [];
  let approximate = false;
  for (let i = 0; i < rawPoints.length - 1; i += 1) {
    const pathId = result.edgePathIds[i];
    const path = pathId ? pathById.get(pathId) : undefined;
    if (path && path.verified === false) approximate = true;
    legs.push({ from: rawPoints[i], to: rawPoints[i + 1], pathName: path?.name ?? null });
  }

  return {
    points: dedupe(rawPoints),
    distanceMeters: result.distanceMeters,
    walkMinutes: estimateWalkMinutes(result.distanceMeters),
    steps: buildRouteSteps(legs, options),
    viaNetwork: true,
    approximate,
  };
}
