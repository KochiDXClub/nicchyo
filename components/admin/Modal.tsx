"use client";

// 管理画面の共通モーダル。`fixed inset-0` の個別実装が複数箇所にあった問題
// （docs/DESIGN_SYSTEM.md §6）の受け皿。今はコード健康診断ページだけが使っている。
//
// components/ui/ には置かない。"use client" を要るものを置くと、バレル経由で
// サーバーコンポーネントから読まれたときに壊れる（DESIGN_SYSTEM.md §5）。

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClassName?: string;
}

export function Modal({ open, onClose, title, children, widthClassName = "max-w-2xl" }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 呼び出し側が毎回新しい onClose を渡しても、開いている間に effect を張り直さない
  // （張り直すとクリーンアップで元の要素にフォーカスが戻ってしまう）
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-nicchyo-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${widthClassName} max-h-[85vh] overflow-y-auto rounded-panel bg-white p-6 shadow-float ring-1 ring-line focus:outline-none`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-nicchyo-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-2 py-1 text-sm text-nicchyo-ink/55 hover:bg-nicchyo-base hover:text-nicchyo-ink"
          >
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
