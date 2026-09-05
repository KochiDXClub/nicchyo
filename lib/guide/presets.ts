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
    kinds: ['transit'],
  },
  {
    id: 'restroom',
    label: 'お手洗いに行きたい',
    emoji: '🚻',
    kinds: ['restroom'],
    preferTags: ['多目的あり'],
    hideClosed: true,
  },
  {
    id: 'rest',
    label: 'ひと休みしたい',
    emoji: '🌿',
    kinds: ['rest'],
    preferTags: ['ベンチあり', '木かげあり'],
  },
  {
    id: 'rain',
    label: '雨をしのぎたい',
    emoji: '☔',
    kinds: ['rest', 'landmark', 'restroom'],
    requiredAnyTags: ['屋根あり', '屋内'],
  },
];

export function getGuidePreset(id: string | null | undefined): GuidePreset | null {
  if (!id) return null;
  return GUIDE_PRESETS.find((preset) => preset.id === id) ?? null;
}
