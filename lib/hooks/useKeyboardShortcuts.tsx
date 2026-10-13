/**
 * キーボードショートカットフック
 * PC操作を前提とした管理画面向け
 */

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Command key on Mac
  description: string;
  action: () => void;
}

/**
 * キーボードショートカットを登録
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: 's', ctrl: true, description: '検索フォーカス', action: () => searchRef.current?.focus() },
 *   { key: 'a', ctrl: true, description: '全選択', action: handleSelectAll },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 入力フィールド内では無効化
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          // Ctrl+A (全選択) は入力フィールド外でのみ有効
          if (shortcut.key === "a" && shortcut.ctrl && !isInputField) {
            event.preventDefault();
            shortcut.action();
            return;
          }

          // その他のショートカットは入力フィールド内では無効
          if (!isInputField) {
            event.preventDefault();
            shortcut.action();
            return;
          }
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * ショートカット一覧を表示するヘルプモーダル用のコンポーネント
 */
export function ShortcutHelp({ shortcuts }: { shortcuts: KeyboardShortcut[] }) {
  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys: string[] = [];
    if (shortcut.ctrl) keys.push("Ctrl");
    if (shortcut.shift) keys.push("Shift");
    if (shortcut.alt) keys.push("Alt");
    keys.push(shortcut.key.toUpperCase());
    return keys.join(" + ");
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-line last:border-0">
            <span className="text-sm text-nicchyo-ink/70">{shortcut.description}</span>
            <kbd className="px-2 py-1 text-xs font-semibold text-nicchyo-ink bg-nicchyo-base border border-line rounded">
              {formatShortcut(shortcut)}
            </kbd>
          </div>
        ))}
      </div>
      <p className="text-xs text-nicchyo-ink/55 mt-4">
        ヒント: <kbd className="px-1 py-0.5 text-xs bg-nicchyo-base border border-line rounded">?</kbd> でこのヘルプを表示
      </p>
    </div>
  );
}
