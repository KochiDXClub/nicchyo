"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function ConsultSheet({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    // DOM から外れる前に close し、開いたボタンへフォーカスを戻す。
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/40 open:flex open:items-end open:justify-center sm:open:items-center"
    >
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-sheet bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:rounded-sheet">
        {children}
      </div>
    </dialog>
  );
}
