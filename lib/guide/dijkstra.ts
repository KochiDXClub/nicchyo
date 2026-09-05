/**
 * ダイクストラ法（ノード数は多くても数百なので、単純な配列ベースで十分）
 */

import type { GuideNetwork } from './types';

export type ShortestPath = {
  /** 出発ノードから到着ノードまでのノードID列 */
  nodeIds: number[];
  /** 各区間で使った道のID（nodeIds.length - 1 個） */
  edgePathIds: Array<string | null>;
  distanceMeters: number;
};

export function shortestPath(network: GuideNetwork, from: number, to: number): ShortestPath | null {
  if (from === to) return { nodeIds: [from], edgePathIds: [], distanceMeters: 0 };

  const count = network.nodes.length;
  const dist = new Array<number>(count).fill(Infinity);
  const prev = new Array<number>(count).fill(-1);
  const prevPath = new Array<string | null>(count).fill(null);
  const done = new Array<boolean>(count).fill(false);
  dist[from] = 0;

  for (let iteration = 0; iteration < count; iteration += 1) {
    let current = -1;
    let best = Infinity;
    for (let id = 0; id < count; id += 1) {
      if (!done[id] && dist[id] < best) {
        best = dist[id];
        current = id;
      }
    }
    if (current === -1) break;
    if (current === to) break;
    done[current] = true;

    for (const edge of network.adjacency.get(current) ?? []) {
      const next = dist[current] + edge.distanceMeters;
      if (next < dist[edge.to]) {
        dist[edge.to] = next;
        prev[edge.to] = current;
        prevPath[edge.to] = edge.pathId;
      }
    }
  }

  if (!Number.isFinite(dist[to])) return null;

  const nodeIds: number[] = [];
  const edgePathIds: Array<string | null> = [];
  let cursor = to;
  while (cursor !== -1) {
    nodeIds.push(cursor);
    if (cursor !== from) edgePathIds.push(prevPath[cursor]);
    cursor = prev[cursor];
  }
  nodeIds.reverse();
  edgePathIds.reverse();
  return { nodeIds, edgePathIds, distanceMeters: dist[to] };
}
