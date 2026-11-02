'use client';

import { usePathname } from 'next/navigation';
import { stripLocalePrefix } from './config';

/**
 * ロケールを外したパス（/en/map → /map）。
 * usePathname() はブラウザのURLをそのまま返すため、パスで画面を判定する処理
 * （ナビの現在地・マップかどうか等）には、こちらを使う
 */
export function useAppPathname(): string {
  const pathname = usePathname();
  return stripLocalePrefix(pathname).pathname;
}
