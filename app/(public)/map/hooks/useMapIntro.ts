'use client';

/**
 * useMapIntro
 *
 * マップの初回案内パネル（MapIntroPanel）を開くかどうかを決める。
 *
 * 【なぜ独立した LP ページを作らないか】
 * このサービスの入口はマップそのもので、マップへ直行している感覚を壊したくない。
 * そのため説明は別ページに出さず、読み込み終わったマップの「上に」パネルとして重ねる。
 *
 * 【開く条件】
 * - 地図が描き終わっている（mapArrived）
 *   読み込み中に被せると「LP を見てからマップへ行く」体験になり、別ページと変わらない。
 *   必ず地図が出たあとに下から上げる。
 * - 初回（localStorage に記録がない）か、?panel=intro で明示的に呼ばれた
 * - ディープリンクで来ていない
 *   QR で特定の店に来た人・おでかけサポートのリンクで来た人には、
 *   目的の画面が既に開いているので案内を被せない。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSeenMapIntro, markMapIntroSeen } from '@/lib/storage/mapIntro';

/** ?panel=intro で案内パネルを開く（メニューや配布用リンクから使う） */
export const MAP_INTRO_PANEL_VALUE = 'intro';

/**
 * 案内より優先する URL パラメータ。
 * ひとつでも付いていれば、初回でも自動では開かない。
 */
const DEEP_LINK_PARAMS = [
  'shop',
  'guide',
  'facility',
  'ai',
  'search',
  'q',
  'walkPlan',
  'panel',
] as const;

export function hasMapDeepLink(params: { get(name: string): string | null } | null | undefined): boolean {
  if (!params) return false;
  return DEEP_LINK_PARAMS.some((key) => {
    const value = params.get(key);
    return value !== null && value !== '';
  });
}

/**
 * 案内を自動で開くか。`requested`（?panel=intro）はこの判定より優先されるため、
 * ここでは扱わない。
 */
export function shouldAutoOpenMapIntro(args: {
  seen: boolean;
  hasDeepLink: boolean;
  mapArrived: boolean;
}): boolean {
  if (!args.mapArrived) return false;
  if (args.hasDeepLink) return false;
  return !args.seen;
}

type UseMapIntroArgs = {
  /** ?panel=intro が付いている（初回済みでも開く） */
  requested: boolean;
  /** 案内より優先する URL パラメータが付いている */
  hasDeepLink: boolean;
  /** 地図の読み込みが終わって画面に出ている */
  mapArrived: boolean;
};

export function useMapIntro({ requested, hasDeepLink, mapArrived }: UseMapIntroArgs): {
  open: boolean;
  close: () => void;
} {
  const [open, setOpen] = useState(false);
  // 一度閉じたら、同じ画面のまま条件が満たされても開き直さない
  const [dismissed, setDismissed] = useState(false);
  const prevRequestedRef = useRef(false);

  useEffect(() => {
    if (!mapArrived) return;
    // メニューの「はじめての方へ」を押し直したときは、閉じたあとでも開き直す。
    // 閉じるときに ?panel=intro を history.replaceState で外しているので、
    // 押すたびに false → true の立ち上がりとして拾える
    const justRequested = requested && !prevRequestedRef.current;
    prevRequestedRef.current = requested;

    if (justRequested) {
      setDismissed(false);
      setOpen(true);
      return;
    }
    if (dismissed) return;
    if (requested) {
      setOpen(true);
      return;
    }
    // localStorage は描画後に読む（サーバー描画と食い違わせない）
    if (shouldAutoOpenMapIntro({ seen: hasSeenMapIntro(), hasDeepLink, mapArrived })) {
      setOpen(true);
    }
  }, [dismissed, hasDeepLink, mapArrived, requested]);

  const close = useCallback(() => {
    setOpen(false);
    setDismissed(true);
    markMapIntroSeen();
  }, []);

  return { open, close };
}
