import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * 画面の広さ。スマホと PC で案内の形そのものを変える。
 *
 * スマホ … 地図の上に重なるボトムシート。半分だけ開いて、スクロールで全画面
 * PC     … 中央のダイアログ。最初から開ききっている
 *
 * 引き上げて広げる・下へ払って閉じるのは指の作法で、マウスには意味がない。
 * 同じ形を両方に出すと、PC では「スマホ画面がそのまま乗っている」ように見える。
 */
export function useIsDesktop(): boolean {
  // 最初の描画から正しい値で始める。false から始めると、PC でも一瞬だけ
  // ボトムシートが組まれてしまう。案内は地図が描き終わってから開くので、
  // ここが動くのは必ずブラウザの中
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  );
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

/** 画面の高さ。アドレスバーの出入りやスマホの回転に追従する */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerHeight
  );
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}
