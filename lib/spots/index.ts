export type { MapSpot, SpotKind, TransitMode } from './types';
export { getSpotKindMeta, TRAM_ACCENT_COLOR, JR_ACCENT_COLOR } from './spotMeta';
export {
  landmarkToSpot,
  facilityToSpot,
  landmarkSpotId,
  facilitySpotId,
  getTransitModeFromLandmarkKey,
  resolveLandmarkKind,
} from './adapters';
