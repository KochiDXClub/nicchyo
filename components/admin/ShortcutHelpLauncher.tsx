"use client";

import { HelpCircle } from "lucide-react";
import { ShortcutHelp, type KeyboardShortcut } from "@/lib/hooks/useKeyboardShortcuts";
import { Modal } from "./Modal";
import { Tooltip } from "./desktop/Tooltip";

/**
 * 画面右下の「?」ボタンと、キーボードショートカットの一覧。PC のみ。
 * 一覧は useKeyboardShortcuts に渡したものと同じ配列を渡す（登録と案内が食い違わない）。
 * 開閉の状態は呼び出し側が持つ（「?」キーのショートカットからも開けるように）。
 */
export function ShortcutHelpLauncher({
  shortcuts,
  open,
  onOpenChange,
}: {
  shortcuts: KeyboardShortcut[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <div className="hidden sm:block">
        <Tooltip content="キーボードショートカット (?)">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="fixed bottom-8 right-8 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-nicchyo-ink text-white shadow-float transition hover:bg-black"
            aria-label="キーボードショートカット一覧を表示"
          >
            <HelpCircle size={24} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      <Modal open={open} onClose={() => onOpenChange(false)} title="キーボードショートカット" widthClassName="max-w-md">
        <ShortcutHelp shortcuts={shortcuts} />
      </Modal>
    </>
  );
}

