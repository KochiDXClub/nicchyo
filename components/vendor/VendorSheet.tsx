"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import { useDialogFocus } from "@/lib/ui/useDialogFocus";

/**
 * 出店者ページで使う、画面の下から上がってくるシートの外枠。
 * 背景（押すと閉じる）・シート本体・つまみ・Esc で閉じる・背面スクロールの固定・
 * フォーカス（開いたら中へ、閉じたら元の場所へ）を持つ。中身は children に渡す。
 *
 * 出店者の下部ナビ（z-[9997]）とPCのサイドバー（z-[9999]）より手前に出す。
 * AnimatePresence の中で使うと、閉じるときに下へ下がって消える。
 */
export default function VendorSheet({
  label,
  labelledBy,
  focusKey,
  busy = false,
  onClose,
  children,
}: {
  /** シートの名前（読み上げ用）。labelledBy と どちらか一方を渡す */
  label?: string;
  /** シートの名前になる見出しの id */
  labelledBy?: string;
  /** 変わったら、フォーカスをシートの中の最初の入力へ移し直す（次の質問へ進んだときなど） */
  focusKey?: unknown;
  /** 保存中など、閉じさせたくないあいだは true */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  useBodyScrollLock(true);
  const sheetRef = useRef<HTMLElement>(null);
  useDialogFocus(sheetRef, focusKey);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex items-end justify-center"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.18 } }}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-nicchyo-ink/40 backdrop-blur-[2px]"
      />
      <motion.section
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        className="relative max-h-[90dvh] w-full max-w-[38rem] overflow-y-auto overscroll-contain rounded-t-sheet bg-nicchyo-base shadow-float outline-none"
        style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 1.5rem)" }}
        initial={reduceMotion ? false : { y: "100%" }}
        animate={{ y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-nicchyo-ink/15" aria-hidden="true" />
        {children}
      </motion.section>
    </motion.div>
  );
}
