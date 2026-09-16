/**
 * OpenStreetMap 由来の歩行者ネットワーク（lib/guide/data/kochi-walk-network.json）から
 * 案内用のグラフを組み立てる。
 *
 * 道どうしは同じノード番号を共有して交差しているので、端点の近さで交差点を
 * 推定する必要がなく、実際の道路網どおりにつながる。
 */

import { distanceInMeters } from '@/lib/facilities/geo';
import type { GuideNetwork, GuideNetworkEdge, GuideNetworkNode, GuidePath, GuidePathKind, LatLng } from './types';

export type WalkNetworkData = {
  bbox: [number, number, number, number];
  nodes: Array<[number, number]>;
  ways: Array<[string, string, number[]]>;
};

/** 名前の無い道に付ける呼び名（ステップ案内で「小道を東へ約30m」のように使う） */
export function fallbackPathName(kind: GuidePathKind): string {
  return kind === 'path' ? '小道' : '通り';
}

/**
 * 歩行者ネットワークをグラフにする。
 * - ノードは共有されるので、交差点で自然につながる
 * - `paths` には各道の折れ線を入れ、attachPoint（起点・目的地の接続）で使う
 * - `segmentNodes` に区間 → 両端ノードの対応を持ち、接続を O(1) にする
 */
export function buildWalkNetwork(data: WalkNetworkData, extraPaths: GuidePath[] = []): GuideNetwork {
  const nodes: GuideNetworkNode[] = data.nodes.map(([lat, lng], id) => ({ id, point: { lat, lng }, pathId: null }));
  const adjacency = new Map<number, GuideNetworkEdge[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  const paths: GuidePath[] = [];
  const segmentNodes = new Map<string, [number, number]>();

  const addEdge = (a: number, b: number, pathId: string) => {
    if (a === b) return;
    const distanceMeters = distanceInMeters(nodes[a].point, nodes[b].point);
    adjacency.get(a)!.push({ to: b, distanceMeters, pathId });
    adjacency.get(b)!.push({ to: a, distanceMeters, pathId });
  };

  data.ways.forEach(([rawName, rawKind, indexes], wayIndex) => {
    if (indexes.length < 2) return;
    const kind: GuidePathKind = rawKind === 'path' ? 'path' : 'street';
    const id = `osm-${wayIndex}`;
    const name = rawName || fallbackPathName(kind);
    const points: LatLng[] = indexes.map((i) => nodes[i].point);
    paths.push({ id, name, kind, points, verified: true });
    for (let i = 0; i < indexes.length - 1; i += 1) {
      const a = indexes[i];
      const b = indexes[i + 1];
      if (nodes[a].pathId === null) nodes[a].pathId = id;
      if (nodes[b].pathId === null) nodes[b].pathId = id;
      addEdge(a, b, id);
      segmentNodes.set(`${id}:${i}`, [a, b]);
    }
  });

  // 追加の道（管理画面で引いた道など）は、頂点をノードとして足し、
  // 端点が歩行者ネットワークの近くにあれば区間へつなぐ
  for (const path of extraPaths) {
    if (path.points.length < 2) continue;
    const ids = path.points.map((point) => {
      const id = nodes.length;
      nodes.push({ id, point, pathId: path.id });
      adjacency.set(id, []);
      return id;
    });
    for (let i = 0; i < ids.length - 1; i += 1) {
      addEdge(ids[i], ids[i + 1], path.id);
      segmentNodes.set(`${path.id}:${i}`, [ids[i], ids[i + 1]]);
    }
    paths.push(path);
  }

  const network: GuideNetwork = { paths, nodes, adjacency, segmentJunctions: new Map(), segmentNodes };
  joinExtraPathEndpoints(network, extraPaths);
  return network;
}

/** 追加の道の端点を、近くの歩行者ネットワークの区間へつなぐ（30m 以内） */
function joinExtraPathEndpoints(network: GuideNetwork, extraPaths: GuidePath[]): void {
  const JOIN_METERS = 30;
  for (const path of extraPaths) {
    const endpoints = [path.points[0], path.points[path.points.length - 1]];
    for (const endpoint of endpoints) {
      const endpointNode = network.nodes.find((n) => n.pathId === path.id && samePoint(n.point, endpoint));
      if (!endpointNode) continue;
      let best: { distance: number; a: number; b: number } | null = null;
      for (const [key, [a, b]] of network.segmentNodes ?? []) {
        if (key.startsWith(`${path.id}:`)) continue;
        const d = Math.min(
          distanceInMeters(endpoint, network.nodes[a].point),
          distanceInMeters(endpoint, network.nodes[b].point)
        );
        if (!best || d < best.distance) best = { distance: d, a, b };
      }
      if (!best || best.distance > JOIN_METERS) continue;
      const target = distanceInMeters(endpoint, network.nodes[best.a].point) <= distanceInMeters(endpoint, network.nodes[best.b].point) ? best.a : best.b;
      const distanceMeters = distanceInMeters(endpoint, network.nodes[target].point);
      network.adjacency.get(endpointNode.id)!.push({ to: target, distanceMeters, pathId: path.id });
      network.adjacency.get(target)!.push({ to: endpointNode.id, distanceMeters, pathId: path.id });
    }
  }
}

function samePoint(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
}

export function isInsideWalkNetwork(data: WalkNetworkData, point: LatLng): boolean {
  const [s, w, n, e] = data.bbox;
  return point.lat >= s && point.lat <= n && point.lng >= w && point.lng <= e;
}
