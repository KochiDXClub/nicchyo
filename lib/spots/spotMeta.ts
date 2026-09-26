import type { SpotKind, TransitMode } from './types';

export type SpotKindMeta = {
  /** カードの見出しに出す種別ラベル */
  label: string;
  emoji: string;
  accentColor: string;
};

export const TRAM_ACCENT_COLOR = '#f97316';
export const JR_ACCENT_COLOR = '#1d4ed8';
export const EVACUATION_ACCENT_COLOR = '#047857';

const KIND_META: Record<SpotKind, SpotKindMeta> = {
  transit: { label: 'のりもの', emoji: '🚋', accentColor: TRAM_ACCENT_COLOR },
  landmark: { label: '目印', emoji: '🏯', accentColor: '#b45309' },
  restroom: { label: 'お手洗い', emoji: '🚻', accentColor: '#0284c7' },
  rest: { label: '休けい', emoji: '🌿', accentColor: '#059669' },
  // 避難誘導標識（JIS Z 8210）の緑に寄せる。休けいの緑とは濃さで見分ける
  evacuation: { label: '避難場所', emoji: '🏃', accentColor: EVACUATION_ACCENT_COLOR },
  shop: { label: 'お店', emoji: '🏪', accentColor: '#7ED957' },
};

export function getSpotKindMeta(kind: SpotKind, transitMode?: TransitMode): SpotKindMeta {
  const base = KIND_META[kind];
  if (kind === 'transit') {
    if (transitMode === 'jr') return { label: 'JR', emoji: '🚃', accentColor: JR_ACCENT_COLOR };
    return { label: '路面電車', emoji: '🚋', accentColor: TRAM_ACCENT_COLOR };
  }
  return base;
}
