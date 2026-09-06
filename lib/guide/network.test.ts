import { describe, expect, it } from 'vitest';
import { shortestPath } from './dijkstra';
import { attachPoint, buildGuideNetwork, cloneNetwork } from './network';
import type { GuidePath } from './types';

/**
 * テスト用の道: 東西に走る本通り（追手筋）と、その途中から南へ下りる横道。
 * 横道の北端は本通りの 5m 南に置き、自動でつながる（joinDistance 25m 以内）ことを確かめる。
 */
const mainStreet: GuidePath = {
  id: 'main',
  name: '追手筋',
  kind: 'market',
  verified: true,
  points: [
    { lat: 33.562, lng: 133.534 },
    { lat: 33.562, lng: 133.538 },
    { lat: 33.562, lng: 133.542 },
  ],
};

const sideStreet: GuidePath = {
  id: 'side',
  name: '横道',
  kind: 'street',
  verified: false,
  points: [
    { lat: 33.56195, lng: 133.538 },
    { lat: 33.5605, lng: 133.538 },
  ],
};

describe('buildGuideNetwork', () => {
  it('道の頂点がノードになり、隣り合う頂点がつながる', () => {
    const network = buildGuideNetwork([mainStreet]);
    expect(network.nodes).toHaveLength(3);
    expect(network.adjacency.get(0)?.map((e) => e.to)).toEqual([1]);
    expect(network.adjacency.get(1)?.map((e) => e.to).sort()).toEqual([0, 2]);
  });

  it('横道の端点が本通りの近くにあれば交差点ができてつながる', () => {
    const network = buildGuideNetwork([mainStreet, sideStreet]);
    // 本通り3 + 横道2 + 交差点1
    expect(network.nodes).toHaveLength(6);
    const junction = network.nodes[5];
    expect(junction.pathId).toBe('main');
    expect(junction.point.lat).toBeCloseTo(33.562, 6);
    expect(junction.point.lng).toBeCloseTo(133.538, 6);
    // 横道の北端（node 3）→ 交差点 → 本通りの区間の両端（本通りのノード2つ）
    expect(network.adjacency.get(3)?.some((e) => e.to === 5)).toBe(true);
    const junctionNeighbors = network.adjacency.get(5)?.map((e) => e.to) ?? [];
    expect(junctionNeighbors).toContain(3);
    expect(junctionNeighbors.filter((id) => network.nodes[id].pathId === 'main')).toHaveLength(2);
  });

  it('端点が遠い道はつながらない', () => {
    const far: GuidePath = {
      ...sideStreet,
      id: 'far',
      points: [
        { lat: 33.5615, lng: 133.538 },
        { lat: 33.5605, lng: 133.538 },
      ],
    };
    const network = buildGuideNetwork([mainStreet, far]);
    expect(network.nodes).toHaveLength(5);
  });
});

describe('attachPoint + shortestPath', () => {
  it('本通りの北にいる人から横道の先までは、本通り → 交差点 → 横道の順にたどる', () => {
    const network = cloneNetwork(buildGuideNetwork([mainStreet, sideStreet]));
    const origin = attachPoint(network, { lat: 33.5622, lng: 133.535 });
    const destination = attachPoint(network, { lat: 33.5604, lng: 133.5381 });
    const result = shortestPath(network, origin, destination);
    expect(result).not.toBeNull();
    // 起点の仮ノード → 追手筋 → 横道 → 目的地の仮ノード
    expect(result!.edgePathIds[0]).toBeNull();
    expect(result!.edgePathIds).toContain('main');
    expect(result!.edgePathIds).toContain('side');
    expect(result!.edgePathIds[result!.edgePathIds.length - 1]).toBeNull();
    // 直線（約300m）よりは長いが、極端な遠回りではない
    expect(result!.distanceMeters).toBeGreaterThan(300);
    expect(result!.distanceMeters).toBeLessThan(600);
  });

  it('つながっていない道同士は経路が無い', () => {
    const island: GuidePath = {
      id: 'island',
      name: '離れ小島',
      kind: 'path',
      points: [
        { lat: 33.57, lng: 133.55 },
        { lat: 33.571, lng: 133.55 },
      ],
    };
    const network = buildGuideNetwork([mainStreet, island]);
    expect(shortestPath(network, 0, 3)).toBeNull();
  });
});
