/**
 * 目的ベースの入口（シナリオプリセット）
 *
 * 「帰りたい」「雨をしのぎたい」のような来訪者の状況を、種別と条件タグの
 * 組み合わせに翻訳する。エンジン側（rankSpots）はプリセットを知らないので、
 * 新しいプリセットはここに1件足すだけで増やせる。
 */

import type { SpotKind } from '@/lib/spots';

export type GuidePreset = {
  id: string;
  label: string;
  emoji: string;
  /** ボックスに添える一文 */
  description: string;
  kinds: SpotKind[];
  requiredTags?: string[];
  requiredAnyTags?: string[];
  preferTags?: string[];
  /** 時間外のスポットを出さない */
  hideClosed?: boolean;
};

export const GUIDE_PRESETS: GuidePreset[] = [
  {
    id: 'go-home',
    label: '帰りたい',
    emoji: '🚋',
    description: 'いちばん近い電停・駅までの道のりを案内します',
    kinds: ['transit'],
  },
  {
    id: 'restroom',
    label: 'お手洗いに行きたい',
    emoji: '🚻',
    description: '近くで使えるお手洗いをさがします',
    kinds: ['restroom'],
    preferTags: ['多目的あり'],
    hideClosed: true,
  },
  {
    id: 'rest',
    label: 'ひと休みしたい',
    emoji: '🌿',
    description: '荷物を置いて座れる場所をさがします',
    kinds: ['rest'],
    preferTags: ['ベンチあり', '木かげあり'],
  },
  {
    id: 'rain',
    label: '雨をしのぎたい',
    emoji: '☔',
    description: '屋根のある場所・屋内の施設をさがします',
    kinds: ['rest', 'landmark', 'restroom'],
    requiredAnyTags: ['屋根あり', '屋内'],
  },
];

export function getGuidePreset(id: string | null | undefined): GuidePreset | null {
  if (!id) return null;
  return GUIDE_PRESETS.find((preset) => preset.id === id) ?? null;
}
