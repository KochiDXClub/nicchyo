import type { SpotKind, TransitMode } from './types';

export type SpotKindMeta = {
  /** カードの見出しに出す種別ラベル */
  label: string;
  emoji: string;
  accentColor: string;
  /** 地図・/facilities と同じ専用アイコン。無い種類は undefined（呼び出し側で線画に代える） */
  iconUrl?: string;
};

export const TRAM_ACCENT_COLOR = '#f97316';
export const JR_ACCENT_COLOR = '#1d4ed8';

const KIND_META: Record<SpotKind, SpotKindMeta> = {
  transit: { label: 'のりもの', emoji: '🚋', accentColor: TRAM_ACCENT_COLOR, iconUrl: '/images/maps/elements/transit/tram-stop.svg' },
  landmark: { label: '観光地', emoji: '🏯', accentColor: '#b45309' },
  restroom: { label: 'お手洗い', emoji: '🚻', accentColor: '#0284c7', iconUrl: '/images/maps/elements/facilities/restroom.svg' },
  rest: { label: '休けい', emoji: '🌿', accentColor: '#059669', iconUrl: '/images/maps/elements/facilities/rest.svg' },
  shop: { label: 'お店', emoji: '🏪', accentColor: '#7ED957' },
};

export function getSpotKindMeta(kind: SpotKind, transitMode?: TransitMode): SpotKindMeta {
  const base = KIND_META[kind];
  if (kind === 'transit') {
    if (transitMode === 'jr') return { label: 'JR', emoji: '🚃', accentColor: JR_ACCENT_COLOR, iconUrl: '/images/maps/elements/transit/train-stop.svg' };
    return { label: '路面電車', emoji: '🚋', accentColor: TRAM_ACCENT_COLOR, iconUrl: '/images/maps/elements/transit/tram-stop.svg' };
  }
  return base;
}
