"use client";

import type { ReactNode } from "react";
import { EDITOR_COLORS } from "../editorTheme";

/**
 * 選択以外の道具を使っている間、地図の上に出す操作の案内。
 * 中断ボタンは Esc と同じ動きをする。
 */
export default function ToolHint({
  message,
  onCancel,
  children,
}: {
  message: string;
  onCancel: () => void;
  /** 案内の横に並べる追加の操作（「この形で確定」など） */
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px 8px 14px",
        borderRadius: 12,
        background: EDITOR_COLORS.accent,
        color: EDITOR_COLORS.surface,
        boxShadow: "0 2px 8px rgba(15,23,42,.25)",
        fontSize: 12.5,
        fontWeight: 700,
        maxWidth: "min(720px, calc(100% - 200px))",
      }}
    >
      <span>{message}</span>
      {children}
      <button
        type="button"
        onClick={onCancel}
        style={{
          marginLeft: "auto",
          flexShrink: 0,
          padding: "4px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,.5)",
          background: "transparent",
          color: EDITOR_COLORS.surface,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        中断 (Esc)
      </button>
    </div>
  );
}
