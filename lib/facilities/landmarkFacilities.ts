/**
 * map_landmarks（スポット）→ おでかけサポートの Facility への変換
 *
 * お手洗い・休けい場所・のりものは、マップ上のランドマークと同じ
 * map_landmarks テーブルが唯一の情報源。ここで category ごとに Facility 形式へ
 * 変換して、最寄り案内と一覧表示に渡す。
 *
 * 古いデータ（category 列が無い頃のスナップショット等）にも対応するため、
 * category が無い行は key の規約（"tram-*" / "jr-kochi-station"）で電停・駅と判定する。
 * "densha"（チンチン電車の装飾イラスト）は実在の乗り場ではないので対象外。
 */

import type { Landmark } from '@/app/(public)/map/types/landmark';
import type { Facility, FacilityCategoryId } from './facilities';

const TRAM_MARKER_COLOR = '#f97316';
const JR_MARKER_COLOR = '#1d4ed8';

/** 案内対象にする電停・駅のランドマークkeyか判定する（category が無いときの後方互換） */
export function isTransitStopLandmarkKey(key: string): boolean {
  return key === 'jr-kochi-station' || key.startsWith('tram-');
}

/** ランドマークがどのおでかけサポートのカテゴリに属するか。対象外なら null */
export function getFacilityCategoryOfLandmark(landmark: Landmark): FacilityCategoryId | null {
  if (landmark.category === 'transit') return 'transport';
  if (landmark.category === 'restroom') return 'restroom';
  if (landmark.category === 'rest') return 'rest';
  if (landmark.category === 'landmark') return null;
  return isTransitStopLandmarkKey(landmark.key) ? 'transport' : null;
}

function toFacility(landmark: Landmark, category: FacilityCategoryId): Facility {
  const isJr = landmark.transitMode === 'jr' || landmark.key === 'jr-kochi-station';
  return {
    id: `landmark-${landmark.key}`,
    category,
    name: landmark.name,
    area: landmark.description,
    note: landmark.notes,
    tags: landmark.tags && landmark.tags.length > 0 ? landmark.tags : undefined,
    lat: landmark.lat,
    lng: landmark.lng,
    iconUrl: landmark.url,
    markerColor: category === 'transport' ? (isJr ? JR_MARKER_COLOR : TRAM_MARKER_COLOR) : undefined,
    verified: landmark.verified,
  };
}

/** ランドマーク一覧から、指定カテゴリの施設を Facility 形式で取り出す */
export function getFacilitiesFromLandmarks(
  landmarks: Landmark[],
  categoryId: FacilityCategoryId
): Facility[] {
  return landmarks
    .filter((landmark) => getFacilityCategoryOfLandmark(landmark) === categoryId)
    .map((landmark) => toFacility(landmark, categoryId));
}

/** カテゴリごとの件数（おでかけサポートのトップ画面用） */
export function countFacilitiesByCategory(landmarks: Landmark[]): Record<FacilityCategoryId, number> {
  const counts: Record<FacilityCategoryId, number> = { restroom: 0, rest: 0, transport: 0 };
  for (const landmark of landmarks) {
    const category = getFacilityCategoryOfLandmark(landmark);
    if (category) counts[category] += 1;
  }
  return counts;
}

/** 電停・JR駅だけを取り出す（後方互換。getFacilitiesFromLandmarks(…, 'transport') と同じ） */
export function getTransitFacilities(landmarks: Landmark[]): Facility[] {
  return getFacilitiesFromLandmarks(landmarks, 'transport');
}
