"use client";

import { EDITOR_COLORS } from "../editorTheme";
import type { Tool } from "../types";

type ToolDef = { tool: Tool; label: string; icon: string; hint: string };

export const TOOL_DEFS: ToolDef[] = [
  { tool: "select", label: "選択", icon: "↖", hint: "道・区画・建物をクリックして選ぶ" },
  { tool: "drawRoad", label: "道を描く", icon: "〰", hint: "地図をクリックして新しい道を描く" },
  { tool: "splitSlots", label: "区画分け", icon: "▦", hint: "出店可の通りに区画を割り振る" },
  { tool: "placeLandmark", label: "建物を置く", icon: "🏛", hint: "地図をクリックして建物を置く" },
];

/** 地図左上の道具パレット */
export default function ToolPalette({
  tool,
  onChange,
  disabled = {},
}: {
  tool: Tool;
  onChange: (tool: Tool) => void;
  /** 使えない道具と、その理由（ツールチップに出す） */
  disabled?: Partial<Record<Tool, string>>;
}) {
  return (
    <div
      role="toolbar"
      aria-label="編集の道具"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 6,
        background: EDITOR_COLORS.surface,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(15,23,42,.18)",
      }}
    >
      {TOOL_DEFS.map((def) => {
        const active = tool === def.tool;
        const disabledReason = disabled[def.tool];
        return (
          <button
            key={def.tool}
            type="button"
            aria-pressed={active}
            disabled={!!disabledReason}
            onClick={() => onChange(def.tool)}
            title={disabledReason ?? def.hint}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 8,
              border: "none",
              fontSize: 12.5,
              fontWeight: 700,
              textAlign: "left",
              cursor: disabledReason ? "not-allowed" : "pointer",
              opacity: disabledReason ? 0.45 : 1,
              background: active ? EDITOR_COLORS.accent : "transparent",
              color: active ? EDITOR_COLORS.surface : EDITOR_COLORS.ink,
            }}
          >
            <span aria-hidden style={{ width: 16, textAlign: "center" }}>
              {def.icon}
            </span>
            {def.label}
          </button>
        );
      })}
    </div>
  );
}
