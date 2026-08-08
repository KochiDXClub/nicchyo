/**
 * のりもの（電停・JR駅）の施設データを、手打ちの一覧としては持たない。
 *
 * マップ上に常時表示しているランドマーク（map_landmarks テーブル、
 * app/(public)/map/services/landmarksDb.ts 経由で取得）が唯一の情報源で、
 * おでかけサポートの「のりもの」はそこから同じデータを変換して使う。
 * 二重管理を避けることで、停留場が増減してもここは自動で追従する。
 */

import type { Landmark } from '@/app/(public)/map/types/landmark';
import type { Facility } from './facilities';

const TRAM_MARKER_COLOR = '#f97316';
const JR_MARKER_COLOR = '#1d4ed8';

/**
 * 案内対象にする電停・駅のランドマークkeyか判定する。
 * MapView.tsx の isAlwaysVisibleTransitLandmarkKey とほぼ同じだが、
 * "densha"（チンチン電車の装飾イラスト）は実在の乗り場ではなく最寄り案内の
 * 目的地にならないため、こちらには含めない。
 */
export function isTransitStopLandmarkKey(key: string): boolean {
  return key === 'jr-kochi-station' || key.startsWith('tram-');
}

function toFacility(landmark: Landmark): Facility {
  return {
    id: `landmark-${landmark.key}`,
    category: 'transport',
    name: landmark.name,
    area: landmark.description,
    lat: landmark.lat,
    lng: landmark.lng,
    iconUrl: landmark.url,
    markerColor: landmark.key.startsWith('tram-') ? TRAM_MARKER_COLOR : JR_MARKER_COLOR,
  };
}

/** ランドマーク一覧から、のりもの案内の対象（電停・JR駅）だけを Facility 形式で取り出す */
export function getTransitFacilities(landmarks: Landmark[]): Facility[] {
  return landmarks.filter((landmark) => isTransitStopLandmarkKey(landmark.key)).map(toFacility);
}
