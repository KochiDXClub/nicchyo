"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusablesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getAttribute("aria-hidden") !== "true"
  );
}

/**
 * モーダル（role="dialog" aria-modal="true"）のフォーカスの面倒を見る。
 *
 * - 開いたとき、中の最初の操作できる所へフォーカスを移す（`resetKey` が変わったときも移し直す）
 * - Tab / Shift+Tab を中で回し、背面へ出ないようにする
 * - 閉じたとき、開く前にフォーカスがあった所へ戻す（returnFocusRef があればそこへ戻す）
 *
 * aria-modal で背面は読み上げから外れるので、フォーカスだけ背面に残ると
 * キーボードやスクリーンリーダーの利用者がどこにいるか分からなくなる。
 */
export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  resetKey?: unknown,
  options: {
    /**
     * 閉じたときに戻す先。スマホではボタンを押してもフォーカスが移らないことがあるので、
     * 「開いたボタン」がはっきりしているときは渡しておく
     */
    returnFocusRef?: RefObject<HTMLElement | null>;
  } = {}
) {
  const { returnFocusRef } = options;
  // 開いているあいだ Tab を中で回し、閉じたら元の場所へ戻す
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 戻す先は開いたときに決めておく（閉じるときには ref の中身が変わっていることがある）
    const returnTarget = returnFocusRef?.current ?? opener;

    const onKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (event.key !== "Tab" || !container) return;
      const list = focusablesIn(container);
      if (list.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [containerRef, returnFocusRef]);

  // 開いたとき・中身が変わったときに、最初の操作できる所へ移す
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    (focusablesIn(container)[0] ?? container).focus();
  }, [containerRef, resetKey]);
}
