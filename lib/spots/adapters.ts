/**
 * 既存の型（Landmark / Facility）→ MapSpot への変換。
 *
 * ランドマークの key は "tram-*" が電停、"jr-kochi-station" がJR駅という規約
 * （lib/facilities/transitLandmarks.ts と同じ）。それ以外は建物などの目印。
 */

import type { Landmark } from '@/app/(public)/map/types/landmark';
import type { Facility } from '@/lib/facilities/facilities';
import { getSpotKindMeta } from './spotMeta';
import type { MapSpot, SpotKind, TransitMode } from './types';

export const JR_STATION_LANDMARK_KEY = 'jr-kochi-station';
export const TRAM_LANDMARK_PREFIX = 'tram-';

export function getTransitModeFromLandmarkKey(key: string): TransitMode | null {
  if (key === JR_STATION_LANDMARK_KEY) return 'jr';
  if (key.startsWith(TRAM_LANDMARK_PREFIX)) return 'tram';
  return null;
}

export function landmarkSpotId(key: string): string {
  return `landmark:${key}`;
}

export function facilitySpotId(facilityId: string): string {
  return `facility:${facilityId}`;
}

export function landmarkToSpot(landmark: Landmark): MapSpot {
  const transitMode = getTransitModeFromLandmarkKey(landmark.key);
  const kind: SpotKind = transitMode ? 'transit' : 'landmark';
  const meta = getSpotKindMeta(kind, transitMode ?? undefined);
  return {
    id: landmarkSpotId(landmark.key),
    kind,
    transitMode: transitMode ?? undefined,
    name: landmark.name,
    description: landmark.description,
    lat: landmark.lat,
    lng: landmark.lng,
    iconUrl: landmark.url,
    emoji: meta.emoji,
    accentColor: meta.accentColor,
    landmarkKey: landmark.key,
  };
}

/**
 * おでかけサポートの施設 → スポット。
 * のりものは transitLandmarks.ts で `landmark-<key>` というIDに変換されているので、
 * 同じ電停をランドマークとしてタップしたときと同じスポットIDに揃える。
 */
export function facilityToSpot(facility: Facility): MapSpot {
  const landmarkKey = facility.id.startsWith('landmark-')
    ? facility.id.slice('landmark-'.length)
    : null;
  if (landmarkKey) {
    const transitMode = getTransitModeFromLandmarkKey(landmarkKey);
    const meta = getSpotKindMeta('transit', transitMode ?? undefined);
    return {
      id: landmarkSpotId(landmarkKey),
      kind: 'transit',
      transitMode: transitMode ?? undefined,
      name: facility.name,
      description: facility.area,
      lat: facility.lat,
      lng: facility.lng,
      iconUrl: facility.iconUrl,
      emoji: meta.emoji,
      accentColor: facility.markerColor ?? meta.accentColor,
      notes: facility.note,
      tags: facility.tags,
      landmarkKey,
    };
  }

  const kind: SpotKind =
    facility.category === 'restroom' ? 'restroom' : facility.category === 'rest' ? 'rest' : 'transit';
  const meta = getSpotKindMeta(kind);
  return {
    id: facilitySpotId(facility.id),
    kind,
    name: facility.name,
    description: facility.area,
    lat: facility.lat,
    lng: facility.lng,
    iconUrl: facility.iconUrl,
    emoji: meta.emoji,
    accentColor: facility.markerColor ?? meta.accentColor,
    notes: facility.note,
    tags: facility.tags,
  };
}
