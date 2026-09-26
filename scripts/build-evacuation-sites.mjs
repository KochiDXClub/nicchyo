#!/usr/bin/env node
/**
 * 国土地理院「指定緊急避難場所データ」から、日曜市の会場（追手筋）まわりの
 * 避難場所を抜き出して lib/evacuation/data/otesuji-evacuation-sites.json に書く。
 *
 *   node scripts/build-evacuation-sites.mjs <高知市の指定緊急避難場所 GeoJSON> [取得日 YYYY-MM-DD]
 *
 * 入力は国土地理院が配布する GeoJSON（https://hinanmap.gsi.go.jp/ の
 * 「データダウンロード」→ 高知県高知市（団体コード 392014）の指定緊急避難場所）。
 * 属性名（「施設・場所名」「津波」…）は配布データのものをそのまま読む。
 *
 * 注意: 現在の JSON は原本ではなくミラーから作ったもの（lib/evacuation/sites.ts の TODO を参照）。
 * 原本で作り直したら、その TODO を消す。
 *
 * 公式データの値は書き換えない（名前・住所・座標・災害種別はそのまま写す）。
 * ここでするのは、会場から遠いものを落とすことと、アプリで扱う形への並べ替えだけ。
 */

import fs from 'node:fs';
import path from 'node:path';

/** 追手筋の両端（app/(public)/map/config/roadConfig.ts の ROAD_CONFIG.bounds と同じ） */
const ROAD_WEST = { lat: 33.56047, lng: 133.5336783 };
const ROAD_EAST = { lat: 33.56231, lng: 133.5433256 };

/** 会場の通りからこの距離以内の避難場所を載せる（徒歩でおよそ10分） */
const MAX_DISTANCE_METERS = 600;

/**
 * 歩行者ネットワーク（lib/guide/data/kochi-walk-network.json）の範囲。
 * この外にある場所へは道なりの経路を引けないので載せない。
 */
const WALK_NETWORK_BBOX = { south: 33.5555, west: 133.5285, north: 33.5695, east: 133.548 };

/** 配布データの列名 → lib/evacuation/sites.ts の HazardType */
const HAZARD_COLUMNS = [
  ['洪水', 'flood'],
  ['崖崩れ、土石流及び地滑り', 'landslide'],
  ['高潮', 'stormSurge'],
  ['地震', 'earthquake'],
  ['津波', 'tsunami'],
  ['大規模な火事', 'fire'],
  ['内水氾濫', 'inlandFlood'],
  ['火山現象', 'volcano'],
];

const CITY_PREFIX = '高知県高知市';

const EARTH_RADIUS_METERS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** 会場付近の狭い範囲なので、平面に投影して点と線分の距離を測る */
function distanceToRoadMeters(point) {
  const cosLat = Math.cos(toRadians(ROAD_WEST.lat));
  const project = (p) => ({
    x: toRadians(p.lng) * cosLat * EARTH_RADIUS_METERS,
    y: toRadians(p.lat) * EARTH_RADIUS_METERS,
  });
  const a = project(ROAD_WEST);
  const b = project(ROAD_EAST);
  const p = project(point);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function main() {
  const [inputPath, retrievedAt = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
  if (!inputPath) {
    console.error('使い方: node scripts/build-evacuation-sites.mjs <GeoJSON> [取得日 YYYY-MM-DD]');
    process.exit(1);
  }

  const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const sites = [];

  for (const feature of geojson.features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    if (props['都道府県名及び市町村名'] !== CITY_PREFIX) continue;
    if (lat < WALK_NETWORK_BBOX.south || lat > WALK_NETWORK_BBOX.north) continue;
    if (lng < WALK_NETWORK_BBOX.west || lng > WALK_NETWORK_BBOX.east) continue;

    const distance = distanceToRoadMeters({ lat, lng });
    if (distance > MAX_DISTANCE_METERS) continue;

    const hazards = HAZARD_COLUMNS.filter(([column]) => props[column] === '1').map(([, hazard]) => hazard);
    if (hazards.length === 0) continue;

    const address = String(props['住所']).startsWith(CITY_PREFIX)
      ? String(props['住所']).slice(CITY_PREFIX.length)
      : String(props['住所']);

    sites.push({
      id: props['共通ID'],
      name: props['施設・場所名'],
      address,
      lat,
      lng,
      hazards,
      isShelter: props['指定避難所との住所同一'] === '1',
      distance,
    });
  }

  sites.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));

  const output = {
    retrievedAt,
    sites: sites.map(({ distance: _distance, ...site }) => site),
  };

  const outPath = path.join(process.cwd(), 'lib/evacuation/data/otesuji-evacuation-sites.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`${sites.length}件を書き出しました: ${path.relative(process.cwd(), outPath)}`);
}

main();
