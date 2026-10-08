import { useEffect } from "react";

/**
 * body のスクロール固定。
 *
 * 重なって開くもの（メニュー・ストーリーの全画面・近況の半開きシートなど）が
 * それぞれ「開く前の値を覚えて閉じるときに戻す」をすると、閉じる順番しだいで
 * 固定が外れなくなる（先に開いたほうが後に閉じると "hidden" を戻してしまう）。
 * 数を数えて、最後のひとつが閉じたときだけ外す。
 */
let scrollLockCount = 0;

export function lockBodyScroll() {
  scrollLockCount += 1;
  if (scrollLockCount === 1) document.body.style.overflow = "hidden";
}

export function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = "";
}

/** 描かれているあいだ（active のあいだ）body のスクロールを止める */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [active]);
}
