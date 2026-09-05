/**
 * 既存の型（Landmark / Facility）→ MapSpot への変換。
 *
 * 種別は map_landmarks.category を優先し、無い場合（古いデータ）は
 * key の規約（"tram-*" が電停、"jr-kochi-station" がJR駅）から判定する。
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

/** Landmark の種別（category 優先、無ければ key の規約） */
export function resolveLandmarkKind(landmark: Pick<Landmark, 'key' | 'category' | 'transitMode'>): {
  kind: SpotKind;
  transitMode?: TransitMode;
} {
  if (landmark.category === 'transit') {
    return {
      kind: 'transit',
      transitMode: landmark.transitMode ?? getTransitModeFromLandmarkKey(landmark.key) ?? 'tram',
    };
  }
  if (landmark.category === 'restroom' || landmark.category === 'rest') {
    return { kind: landmark.category };
  }
  if (landmark.category === 'landmark') return { kind: 'landmark' };
  const transitMode = getTransitModeFromLandmarkKey(landmark.key);
  return transitMode ? { kind: 'transit', transitMode } : { kind: 'landmark' };
}

const emptyToUndefined = (values?: string[]) => (values && values.length > 0 ? values : undefined);

export function landmarkToSpot(landmark: Landmark): MapSpot {
  const { kind, transitMode } = resolveLandmarkKind(landmark);
  const meta = getSpotKindMeta(kind, transitMode);
  return {
    id: landmarkSpotId(landmark.key),
    kind,
    transitMode,
    name: landmark.name,
    description: landmark.description,
    lat: landmark.lat,
    lng: landmark.lng,
    iconUrl: landmark.url,
    emoji: meta.emoji,
    accentColor: meta.accentColor,
    tags: emptyToUndefined(landmark.tags),
    lines: emptyToUndefined(landmark.lines),
    notes: landmark.notes,
    openFrom: landmark.openFrom,
    openUntil: landmark.openUntil,
    verified: landmark.verified,
    externalUrl: landmark.externalUrl,
    photoUrl: landmark.photoUrl,
    photoCredit: landmark.photoCredit,
    landmarkKey: landmark.key,
  };
}

/**
 * おでかけサポートの施設 → スポット。
 * 施設は map_landmarks 由来で `landmark-<key>` というIDを持つので、
 * 同じ地点をランドマークとしてタップしたときと同じスポットIDに揃える。
 */
export function facilityToSpot(facility: Facility): MapSpot {
  const landmarkKey = facility.id.startsWith('landmark-')
    ? facility.id.slice('landmark-'.length)
    : null;
  const kind: SpotKind =
    facility.category === 'restroom' ? 'restroom' : facility.category === 'rest' ? 'rest' : 'transit';
  const transitMode =
    kind === 'transit' && landmarkKey ? (getTransitModeFromLandmarkKey(landmarkKey) ?? 'tram') : undefined;
  const meta = getSpotKindMeta(kind, transitMode);
  return {
    id: landmarkKey ? landmarkSpotId(landmarkKey) : facilitySpotId(facility.id),
    kind,
    transitMode,
    name: facility.name,
    description: facility.area,
    lat: facility.lat,
    lng: facility.lng,
    iconUrl: facility.iconUrl,
    emoji: meta.emoji,
    accentColor: facility.markerColor ?? meta.accentColor,
    notes: facility.note,
    verified: facility.verified,
    tags: emptyToUndefined(facility.tags),
    landmarkKey: landmarkKey ?? undefined,
  };
}
