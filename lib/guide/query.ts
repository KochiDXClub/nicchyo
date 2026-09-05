/**
 * おでかけサポートの「何を案内するか」を URL パラメータと相互変換する
 *
 *   /map?guide=go-home        … プリセット（lib/guide/presets.ts）
 *   /map?guide=menu           … メニューだけ開く（種別・条件は画面で選ぶ）
 *   /map?facility=restroom    … 旧リンク（/facilities のカテゴリ）。種別1つに変換する
 *
 * URL を起点にすることで、/facilities からのリンク・共有・戻る操作が自然に動く。
 */

import type { SpotKind } from '@/lib/spots';
import { getGuidePreset } from './presets';

export type GuideQuery = {
  presetId: string | null;
  kinds: SpotKind[];
  requiredAnyTags: string[];
  preferTags: string[];
  hideClosed: boolean;
};

export const GUIDE_MENU_VALUE = 'menu';

const FACILITY_TO_KIND: Record<string, SpotKind> = {
  restroom: 'restroom',
  rest: 'rest',
  transport: 'transit',
};

const KIND_TO_FACILITY: Partial<Record<SpotKind, string>> = {
  restroom: 'restroom',
  rest: 'rest',
  transit: 'transport',
};

type ParamsLike = { get(name: string): string | null } | null | undefined;

export function parseGuideQuery(params: ParamsLike): GuideQuery | null {
  const guide = params?.get('guide');
  if (guide) {
    if (guide === GUIDE_MENU_VALUE) {
      return { presetId: null, kinds: [], requiredAnyTags: [], preferTags: [], hideClosed: false };
    }
    const preset = getGuidePreset(guide);
    if (preset) {
      return {
        presetId: preset.id,
        kinds: [...preset.kinds],
        requiredAnyTags: [...(preset.requiredAnyTags ?? [])],
        preferTags: [...(preset.preferTags ?? [])],
        hideClosed: Boolean(preset.hideClosed),
      };
    }
  }
  const facility = params?.get('facility');
  const kind = facility ? FACILITY_TO_KIND[facility] : undefined;
  if (kind) {
    return { presetId: null, kinds: [kind], requiredAnyTags: [], preferTags: [], hideClosed: false };
  }
  return null;
}

/** 案内を開いたままにする URL の値（guide= に入れる）。旧 facility= は guide= に寄せる */
export function guideQueryValue(query: Pick<GuideQuery, 'presetId' | 'kinds'>): string {
  if (query.presetId) return query.presetId;
  return GUIDE_MENU_VALUE;
}

/** /facilities などから使う、種別1つで開くリンク */
export function guideHrefForKind(kind: SpotKind): string {
  const facility = KIND_TO_FACILITY[kind];
  return facility ? `/map?facility=${facility}` : `/map?guide=${GUIDE_MENU_VALUE}`;
}

export function guideHrefForPreset(presetId: string): string {
  return `/map?guide=${presetId}`;
}
