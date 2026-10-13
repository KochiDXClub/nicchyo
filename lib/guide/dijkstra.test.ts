import { describe, expect, it } from "vitest";
import { shortestPath } from "./dijkstra";
import type { GuideNetwork, GuideNetworkEdge } from "./types";

/** 無向グラフから GuideNetwork を作る（[a, b, 距離, pathId]） */
function makeNetwork(
  nodeCount: number,
  edges: Array<[number, number, number, string | null]>,
): GuideNetwork {
  const adjacency = new Map<number, GuideNetworkEdge[]>();
  const add = (from: number, to: number, distanceMeters: number, pathId: string | null) => {
    const list = adjacency.get(from) ?? [];
    list.push({ to, distanceMeters, pathId });
    adjacency.set(from, list);
  };
  for (const [a, b, d, p] of edges) {
    add(a, b, d, p);
    add(b, a, d, p);
  }
  return {
    paths: [],
    nodes: Array.from({ length: nodeCount }, (_, id) => ({
      id,
      point: { lat: 0, lng: 0 },
      pathId: null,
    })),
    adjacency,
    segmentJunctions: new Map(),
  };
}

describe("shortestPath", () => {
  it("出発と到着が同じなら距離0の1ノード経路", () => {
    const net = makeNetwork(2, [[0, 1, 5, "a"]]);
    expect(shortestPath(net, 0, 0)).toEqual({ nodeIds: [0], edgePathIds: [], distanceMeters: 0 });
  });

  it("直行より迂回のほうが短ければ迂回を選ぶ", () => {
    const net = makeNetwork(4, [
      [0, 3, 100, "direct"],
      [0, 1, 10, "x"],
      [1, 2, 10, "y"],
      [2, 3, 10, "z"],
    ]);
    expect(shortestPath(net, 0, 3)).toEqual({
      nodeIds: [0, 1, 2, 3],
      edgePathIds: ["x", "y", "z"],
      distanceMeters: 30,
    });
  });

  it("edgePathIds の長さは nodeIds.length - 1 で、向きを逆にしても距離は同じ", () => {
    const net = makeNetwork(5, [
      [0, 1, 3, "a"],
      [1, 2, 4, "b"],
      [2, 3, 5, null],
      [1, 4, 20, "c"],
      [4, 3, 1, "d"],
    ]);
    const forward = shortestPath(net, 0, 3)!;
    const backward = shortestPath(net, 3, 0)!;
    expect(forward.edgePathIds).toHaveLength(forward.nodeIds.length - 1);
    expect(forward.distanceMeters).toBe(12);
    expect(backward.distanceMeters).toBe(12);
    expect(backward.nodeIds).toEqual([...forward.nodeIds].reverse());
  });

  it("つながっていないノードへは null", () => {
    const net = makeNetwork(4, [
      [0, 1, 5, "a"],
      [2, 3, 5, "b"],
    ]);
    expect(shortestPath(net, 0, 3)).toBeNull();
  });

  it("隣接が空のノードでも落ちない", () => {
    const net = makeNetwork(3, [[0, 1, 5, "a"]]);
    expect(shortestPath(net, 0, 2)).toBeNull();
  });

  it("総当たり（Floyd-Warshall）と一致する（ヒープの順序誤りの検出）", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const n = 40;
    const edges: Array<[number, number, number, string | null]> = [];
    for (let i = 0; i < 120; i++) {
      const a = Math.floor(rand() * n);
      const b = Math.floor(rand() * n);
      if (a === b) continue;
      edges.push([a, b, Math.floor(rand() * 90) + 1, `p${i}`]);
    }
    const net = makeNetwork(n, edges);

    const d = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)),
    );
    for (const [a, b, w] of edges) {
      d[a][b] = Math.min(d[a][b], w);
      d[b][a] = Math.min(d[b][a], w);
    }
    for (let k = 0; k < n; k++)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const result = shortestPath(net, i, j);
        if (Number.isFinite(d[i][j])) {
          expect(result?.distanceMeters).toBe(d[i][j]);
        } else {
          expect(result).toBeNull();
        }
      }
    }
  });
});
