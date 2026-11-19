"use client";

import { Building2, Grid2X2, MousePointer2, Route } from "lucide-react";
import type { Tool } from "../types";

type ToolDef = { tool: Tool; label: string; icon: typeof Route; hint: string };
export const TOOL_DEFS: ToolDef[] = [
  { tool: "select", label: "選択", icon: MousePointer2, hint: "道・区画・建物を選ぶ" },
  { tool: "drawRoad", label: "道を描く", icon: Route, hint: "地図に新しい道を描く" },
  { tool: "splitSlots", label: "区画分け", icon: Grid2X2, hint: "出店可の通りに区画を割り振る" },
  { tool: "placeLandmark", label: "建物を置く", icon: Building2, hint: "地図に建物を置く" },
];
export default function ToolPalette({ tool, onChange, disabled = {} }: { tool: Tool; onChange: (tool: Tool) => void; disabled?: Partial<Record<Tool, string>> }) {
  return <div role="toolbar" aria-label="編集の道具" className="map-editor-palette">{TOOL_DEFS.map(({ tool: value, label, icon: Icon, hint }) => <button key={value} type="button" aria-pressed={tool === value} disabled={!!disabled[value]} onClick={() => onChange(value)} title={disabled[value] ?? hint}><Icon size={17} aria-hidden="true" />{label}</button>)}</div>;
}
