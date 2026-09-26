/**
 * おでかけサポートの「何を案内するか」を URL パラメータと相互変換する
 *
 *   /map?guide=menu           … 案内を開く（種類は画面で選ぶ）
 *   /map?facility=restroom    … /facilities のカテゴリから開く。種類1つに変換する
 *   /map?facility=evacuation  … 避難場所だけを出して開く（災害時の案内ページから）
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
  evacuation: 'evacuation',
};

const KIND_TO_FACILITY: Partial<Record<SpotKind, string>> = {
  restroom: 'restroom',
  rest: 'rest',
  transit: 'transport',
  evacuation: 'evacuation',
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

/**
 * 現在の URL パラメータを基準に、指定したパラメータを更新した /map URL を生成する。
 *
 * router.push や history.replaceState を呼ぶときに、既存のパラメータ（guide、shop、
 * mapFlags 等）が意図せず吹き飛ぶのを防ぐ。
 *
 * - updates に guide がある場合: その値に従う（null/空文字なら削除）
 * - updates に guide がない場合: guideActive が指定されていれば画面の状態（開閉）に合わせる
 * - updates の各キーで null / undefined / 空文字 が渡されたものは削除する
 * - /facilities の旧パラメータは guide に一本化したため削除する
 */
export function buildMapUrl(options: {
  currentSearch?: string;
  guideActive?: boolean;
  updates?: Record<string, string | null | undefined>;
}): string {
  const search = options.currentSearch ?? '';
  const normalizedSearch = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalizedSearch);
  params.delete('facility');

  if (options.updates && 'guide' in options.updates) {
    const val = options.updates.guide;
    if (val) params.set('guide', val);
    else params.delete('guide');
  } else if (options.guideActive !== undefined) {
    if (options.guideActive) {
      if (!params.has('guide')) {
        params.set('guide', GUIDE_MENU_VALUE);
      }
    } else {
      params.delete('guide');
    }
  }

  if (options.updates) {
    for (const [key, value] of Object.entries(options.updates)) {
      if (key === 'guide') continue;
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();
  return query ? `/map?${query}` : '/map';
}
