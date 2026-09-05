/**
 * 道のネットワーク（グラフ）を組み立てる
 *
 *   - 各道（折れ線）の頂点をノード、隣り合う頂点の間をエッジにする
 *   - 道の端点が別の道のすぐそば（joinDistanceMeters 以内）にあれば、その道へ
 *     投影した点を経由してつなぐ（＝交差点を作る）。横道やアーケードは
 *     追手筋の近くに端点を置くだけで自動的につながる
 *
 * 会場周辺は道が十数本なので、事前計算なしで毎回組み立てても十分速い。
 */

import { distanceInMeters } from '@/lib/facilities/geo';
import { projectOntoPolyline } from '@/lib/facilities/route';
import type { GuideNetwork, GuideNetworkEdge, GuideNetworkNode, GuidePath, LatLng } from './types';

export const DEFAULT_JOIN_DISTANCE_METERS = 30;

type Builder = {
  nodes: GuideNetworkNode[];
  adjacency: Map<number, GuideNetworkEdge[]>;
  segmentJunctions: Map<string, number[]>;
};

/**
 * 区間の途中に挿入したノードを登録し、同じ区間上の既存ノードと直接つなぐ。
 * 区間上の点同士は一直線上にあるので、直接の距離でつないでよい。
 */
function registerJunction(builder: Builder, pathId: string, segmentIndex: number, nodeId: number): void {
  const key = `${pathId}:${segmentIndex}`;
  const existing = builder.segmentJunctions.get(key) ?? [];
  for (const other of existing) addEdge(builder, nodeId, other, pathId);
  existing.push(nodeId);
  builder.segmentJunctions.set(key, existing);
}

function addNode(builder: Builder, point: LatLng, pathId: string | null): number {
  const id = builder.nodes.length;
  builder.nodes.push({ id, point, pathId });
  builder.adjacency.set(id, []);
  return id;
}

function addEdge(builder: Builder, a: number, b: number, pathId: string | null): void {
  if (a === b) return;
  const distance = distanceInMeters(builder.nodes[a].point, builder.nodes[b].point);
  builder.adjacency.get(a)!.push({ to: b, distanceMeters: distance, pathId });
  builder.adjacency.get(b)!.push({ to: a, distanceMeters: distance, pathId });
}

/** 道の頂点に対応するノードIDを道ごとに覚えておく */
type PathNodeIds = Map<string, number[]>;

function buildPathNodes(builder: Builder, paths: GuidePath[]): PathNodeIds {
  const ids: PathNodeIds = new Map();
  for (const path of paths) {
    const nodeIds = path.points.map((point) => addNode(builder, point, path.id));
    for (let i = 0; i < nodeIds.length - 1; i += 1) {
      addEdge(builder, nodeIds[i], nodeIds[i + 1], path.id);
    }
    ids.set(path.id, nodeIds);
  }
  return ids;
}

/**
 * 道の端点を、近くの別の道へつなぐ。
 * 投影点を新しいノードとして作り、「端点 → 投影点 → 区間の両端」のエッジを張る。
 */
function joinEndpoints(
  builder: Builder,
  paths: GuidePath[],
  pathNodeIds: PathNodeIds,
  joinDistanceMeters: number
): void {
  for (const path of paths) {
    const nodeIds = pathNodeIds.get(path.id) ?? [];
    if (nodeIds.length === 0) continue;
    const endpoints = nodeIds.length === 1 ? [nodeIds[0]] : [nodeIds[0], nodeIds[nodeIds.length - 1]];

    for (const endpointId of endpoints) {
      const endpoint = builder.nodes[endpointId].point;
      for (const other of paths) {
        if (other.id === path.id || other.points.length < 2) continue;
        const projection = projectOntoPolyline(endpoint, other.points);
        if (!projection || projection.distanceMeters > joinDistanceMeters) continue;

        const otherIds = pathNodeIds.get(other.id) ?? [];
        const segStart = otherIds[projection.segmentIndex];
        const segEnd = otherIds[projection.segmentIndex + 1];
        if (segStart === undefined || segEnd === undefined) continue;

        const junctionId = addNode(builder, projection.point, other.id);
        addEdge(builder, endpointId, junctionId, other.id);
        addEdge(builder, junctionId, segStart, other.id);
        addEdge(builder, junctionId, segEnd, other.id);
        registerJunction(builder, other.id, projection.segmentIndex, junctionId);
      }
    }
  }
}

export function buildGuideNetwork(
  paths: GuidePath[],
  options: { joinDistanceMeters?: number } = {}
): GuideNetwork {
  const joinDistanceMeters = options.joinDistanceMeters ?? DEFAULT_JOIN_DISTANCE_METERS;
  const usable = paths.filter((path) => path.points.length >= 1);
  const builder: Builder = { nodes: [], adjacency: new Map(), segmentJunctions: new Map() };
  const pathNodeIds = buildPathNodes(builder, usable);
  joinEndpoints(builder, usable, pathNodeIds, joinDistanceMeters);
  return {
    paths: usable,
    nodes: builder.nodes,
    adjacency: builder.adjacency,
    segmentJunctions: builder.segmentJunctions,
  };
}

/**
 * ネットワークの外にある点（現在地・目的地）を、いちばん近い道へ仮につなぐ。
 * 返り値は仮ノードのID。仮ノードとエッジは network に追加されるので、
 * 経路探索のたびに buildGuideNetwork からやり直すか、cloneNetwork で複製して使う。
 */
export function attachPoint(
  network: GuideNetwork,
  point: LatLng,
  options: { offRoadFactor?: number; maxCandidates?: number } = {}
): number {
  const offRoadFactor = options.offRoadFactor ?? 1.2;
  const maxCandidates = options.maxCandidates ?? 2;
  const builder: Builder = {
    nodes: network.nodes,
    adjacency: network.adjacency,
    segmentJunctions: network.segmentJunctions,
  };
  const pointId = addNode(builder, point, null);

  // 各道への投影のうち近い順に数本へつなぐ（1本だけだと、道が交差する手前で
  // 遠回りになるケースがあるため）
  const candidates = network.paths
    .map((path) => ({ path, projection: projectOntoPolyline(point, path.points) }))
    .filter((c): c is { path: GuidePath; projection: NonNullable<typeof c.projection> } => c.projection !== null)
    .sort((a, b) => a.projection.distanceMeters - b.projection.distanceMeters)
    .slice(0, maxCandidates);

  for (const { path, projection } of candidates) {
    const junctionId = addNode(builder, projection.point, path.id);
    // 道の外を歩く区間は少し割り増し（建物や植え込みを避けて歩くぶん）
    const offRoad = distanceInMeters(point, projection.point) * offRoadFactor;
    network.adjacency.get(pointId)!.push({ to: junctionId, distanceMeters: offRoad, pathId: null });
    network.adjacency.get(junctionId)!.push({ to: pointId, distanceMeters: offRoad, pathId: null });

    // 投影点を、その区間の両端ノードへつなぐ
    const segmentNodes = findSegmentNodes(network, path.id, projection.segmentIndex);
    if (segmentNodes) {
      addEdge(builder, junctionId, segmentNodes[0], path.id);
      addEdge(builder, junctionId, segmentNodes[1], path.id);
    }
    registerJunction(builder, path.id, projection.segmentIndex, junctionId);
  }

  return pointId;
}

/** 道 pathId の segmentIndex 番目の区間の両端ノードIDを探す */
function findSegmentNodes(network: GuideNetwork, pathId: string, segmentIndex: number): [number, number] | null {
  const path = network.paths.find((p) => p.id === pathId);
  if (!path) return null;
  const start = path.points[segmentIndex];
  const end = path.points[segmentIndex + 1];
  if (!start || !end) {
    // 点が1つだけの道: その点のノードへつなぐ
    const only = network.nodes.find((n) => n.pathId === pathId && samePoint(n.point, path.points[0]));
    return only ? [only.id, only.id] : null;
  }
  const startNode = network.nodes.find((n) => n.pathId === pathId && samePoint(n.point, start));
  const endNode = network.nodes.find((n) => n.pathId === pathId && samePoint(n.point, end));
  return startNode && endNode ? [startNode.id, endNode.id] : null;
}

function samePoint(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
}

/** attachPoint で仮ノードを足す前の状態を汚さないための複製 */
export function cloneNetwork(network: GuideNetwork): GuideNetwork {
  return {
    paths: network.paths,
    nodes: network.nodes.map((node) => ({ ...node })),
    adjacency: new Map(Array.from(network.adjacency.entries()).map(([id, edges]) => [id, edges.map((e) => ({ ...e }))])),
    segmentJunctions: new Map(Array.from(network.segmentJunctions.entries()).map(([key, ids]) => [key, [...ids]])),
  };
}
