"use client";

import { useEffect } from "react";

type Options = {
  /**
   * true のとき、ページ内のリンク（Next.js の <Link> を含む）で別のページへ移動する前にも確認を出す。
   * beforeunload はタブを閉じる・再読み込み・外部サイトへの移動にしか反応せず、
   * アプリ内のページ遷移は素通りするため。
   */
  confirmOnLinkClick?: boolean;
  /** リンクで移動するときの確認文（beforeunload の文言はブラウザ既定のものが出る） */
  message?: string;
};

const DEFAULT_MESSAGE = "保存していない変更があります。このページを離れますか？";

function isSamePageAnchor(anchor: HTMLAnchorElement): boolean {
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search;
}

/** 未保存の変更がある間、ページを離れる前に確認を出す */
export function useUnsavedChangesWarning(isDirty: boolean, options: Options = {}) {
  const { confirmOnLinkClick = false, message = DEFAULT_MESSAGE } = options;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || !confirmOnLinkClick) return;
    // キャプチャ段階で受け、キャンセル時はリンク自身（Next.js の <Link> の onClick）まで届かせない
    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download") || isSamePageAnchor(anchor)) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [isDirty, confirmOnLinkClick, message]);
}
