/**
 * おでかけサポートの「何を案内するか」を URL パラメータと相互変換する
 *
 *   /map?guide=menu           … 案内を開く（種類は画面で選ぶ）
 *   /map?facility=restroom    … /facilities のカテゴリから開く。種類1つに変換する
 *
 * URL を起点にすることで、/facilities からのリンク・共有・戻る操作が自然に動く。
 */

import type { SpotKind } from '@/lib/spots';

export type GuideQuery = {
  kinds: SpotKind[];
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
  if (params?.get('guide') === GUIDE_MENU_VALUE) return { kinds: [] };
  const facility = params?.get('facility');
  const kind = facility ? FACILITY_TO_KIND[facility] : undefined;
  if (kind) return { kinds: [kind] };
  return null;
}

/** /facilities などから使う、種類1つで開くリンク */
export function guideHrefForKind(kind: SpotKind): string {
  const facility = KIND_TO_FACILITY[kind];
  return facility ? `/map?facility=${facility}` : `/map?guide=${GUIDE_MENU_VALUE}`;
}
