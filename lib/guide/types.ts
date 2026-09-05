/**
 * おでかけサポートの案内エンジンで使う型
 *
 *   起点（GuideOrigin） × 目的地（MapSpot） × 道のネットワーク（GuideNetwork）
 *   → 経路（GuideRoute: 折れ線・距離・所要分・ステップ）
 *
 * 従来の lib/facilities/route.ts は「追手筋のセンターライン1本に沿わせる」だけだったが、
 * ここでは複数の道（追手筋・横道・アーケードなど）をつないだグラフ上の最短路を求める。
 */

import type { LatLng } from '@/lib/facilities/geo';

export type { LatLng };

export type GuidePathKind = 'market' | 'street' | 'path';

/** 歩ける道1本（折れ線） */
export type GuidePath = {
  id: string;
  /** ステップ案内に出す名前（「追手筋」「帯屋町アーケード」など） */
  name: string;
  kind: GuidePathKind;
  points: LatLng[];
  /** 座標が実測・確認済みか。false の道は「おおよそ」の案内になる */
  verified?: boolean;
};

export type GuideNetworkNode = {
  id: number;
  point: LatLng;
  pathId: string | null;
};

export type GuideNetworkEdge = {
  to: number;
  distanceMeters: number;
  pathId: string | null;
};

/** 道をつないだグラフ */
export type GuideNetwork = {
  paths: GuidePath[];
  nodes: GuideNetworkNode[];
  adjacency: Map<number, GuideNetworkEdge[]>;
  /**
   * 道の区間（`${pathId}:${segmentIndex}`）ごとに、その区間の途中に挿入した
   * 交差点・仮ノードのID。同じ区間上のノード同士を直接つなぐために使う
   * （つながないと、区間の端まで戻ってから来る遠回りの経路になる）
   */
  segmentJunctions: Map<string, number[]>;
};

export type GuideOriginType = 'geolocation' | 'map-center' | 'spot' | 'venue';

/** 案内の起点。現在地が取れないときも「地図の中心から」「会場の中心から」で案内できる */
export type GuideOrigin = {
  type: GuideOriginType;
  point: LatLng;
  /** 画面に出す短い説明（「現在地」「地図の中心」「はりまや橋停留場」など） */
  label: string;
  spotId?: string;
  accuracyMeters?: number;
};

export type RouteStepKind = 'depart' | 'straight' | 'turn-left' | 'turn-right' | 'arrive';

export type RouteStep = {
  kind: RouteStepKind;
  /** 「追手筋を東へ約120m」のような一文 */
  instruction: string;
  distanceMeters: number;
  at: LatLng;
  /** このステップで歩く道の名前（道の外を歩く区間は null） */
  pathName: string | null;
};

export type GuideRoute = {
  points: LatLng[];
  distanceMeters: number;
  walkMinutes: number;
  steps: RouteStep[];
  /** 道のネットワークを通ったか（false なら直線の目安） */
  viaNetwork: boolean;
  /** 経路が未確認の道を含むか */
  approximate: boolean;
};
