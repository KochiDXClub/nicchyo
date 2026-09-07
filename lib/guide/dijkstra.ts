/**
 * ダイクストラ法（二分ヒープ）。歩行者ネットワークは数千ノードあるので、
 * 配列を毎回なめる実装では遅い。
 */

import type { GuideNetwork } from './types';

export type ShortestPath = {
  /** 出発ノードから到着ノードまでのノードID列 */
  nodeIds: number[];
  /** 各区間で使った道のID（nodeIds.length - 1 個） */
  edgePathIds: Array<string | null>;
  distanceMeters: number;
};

class MinHeap {
  private items: Array<{ id: number; dist: number }> = [];

  get size(): number {
    return this.items.length;
  }

  push(id: number, dist: number): void {
    const items = this.items;
    items.push({ id, dist });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].dist <= items[i].dist) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): { id: number; dist: number } | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left].dist < items[smallest].dist) smallest = left;
        if (right < items.length && items[right].dist < items[smallest].dist) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

export function shortestPath(network: GuideNetwork, from: number, to: number): ShortestPath | null {
  if (from === to) return { nodeIds: [from], edgePathIds: [], distanceMeters: 0 };

  const count = network.nodes.length;
  const dist = new Float64Array(count).fill(Infinity);
  const prev = new Int32Array(count).fill(-1);
  const prevPath = new Array<string | null>(count).fill(null);
  const done = new Uint8Array(count);
  const heap = new MinHeap();
  dist[from] = 0;
  heap.push(from, 0);

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (done[current.id]) continue;
    done[current.id] = 1;
    if (current.id === to) break;

    for (const edge of network.adjacency.get(current.id) ?? []) {
      const next = current.dist + edge.distanceMeters;
      if (next < dist[edge.to]) {
        dist[edge.to] = next;
        prev[edge.to] = current.id;
        prevPath[edge.to] = edge.pathId;
        heap.push(edge.to, next);
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
