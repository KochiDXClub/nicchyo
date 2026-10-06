"use client";

import type { SlotSplitPlan, SlotSplitSettings, SplitSides } from "../slotSplitPlan";
import type { EditableRoad } from "../types";
import { buttonStyle, errorNoteStyle, inputStyle, label, noteStyle, panelWrap, primaryButtonStyle } from "./panelStyles";

const SIDE_OPTIONS: Array<{ value: SplitSides; label: string }> = [
  { value: "both", label: "両側" },
  { value: "left", label: "左側だけ" },
  { value: "right", label: "右側だけ" },
];

/**
 * 区画分けツールの設定欄。設定を変えるたびに地図にプレビューが出て、「適用」で確定する。
 * 左右は道の始点から終点へ向かって見た向き（地図上の道の点の並び）。
 */
export default function SlotSplitPanel({
  road,
  roadLengthM,
  settings,
  onChange,
  plan,
  unanchoredCount,
  onApply,
  onCancel,
}: {
  road: EditableRoad;
  roadLengthM: number;
  settings: SlotSplitSettings;
  onChange: (settings: SlotSplitSettings) => void;
  plan: SlotSplitPlan;
  /** この道の近くにあるが、道基準の位置を持たない（移行前の）区画の数。区画分けの対象外 */
  unanchoredCount: number;
  onApply: () => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<SlotSplitSettings>) => onChange({ ...settings, ...patch });
  const numberValue = (value: string) => (value === "" ? Number.NaN : Number(value));
  const hasChange = plan.creates.length + plan.deletes.length + plan.moves.length > 0;

  return (
    <div style={panelWrap}>
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900 }}>区画分け：{road.name}</p>
      <p style={noteStyle}>道の長さ {Math.floor(roadLengthM)}m。左右は道の始点から終点へ向かって見た向きです。</p>

      <span style={label}>分け方</span>
      <div style={{ display: "flex", gap: 12, marginBottom: 10, fontSize: 13 }}>
        <label>
          <input type="radio" checked={settings.mode === "count"} onChange={() => set({ mode: "count" })} /> 区画数で
        </label>
        <label>
          <input type="radio" checked={settings.mode === "interval"} onChange={() => set({ mode: "interval" })} /> 間隔で
        </label>
      </div>

      {settings.mode === "count" ? (
        <label>
          <span style={label}>片側あたりの区画数</span>
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isNaN(settings.count) ? "" : settings.count}
            onChange={(e) => set({ count: numberValue(e.target.value) })}
            style={inputStyle}
          />
        </label>
      ) : (
        <label>
          <span style={label}>区画の間隔（m）</span>
          <input
            type="number"
            min={1}
            step={0.5}
            value={Number.isNaN(settings.intervalM) ? "" : settings.intervalM}
            onChange={(e) => set({ intervalM: numberValue(e.target.value) })}
            style={inputStyle}
          />
        </label>
      )}

      <label>
        <span style={label}>並べる側</span>
        <select value={settings.sides} onChange={(e) => set({ sides: e.target.value as SplitSides })} style={inputStyle}>
          {SIDE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1 }}>
          <span style={label}>開始位置（m）</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={Number.isNaN(settings.startM) ? "" : settings.startM}
            onChange={(e) => set({ startM: numberValue(e.target.value) })}
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1 }}>
          <span style={label}>終了位置（m）</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={Number.isNaN(settings.endM) ? "" : settings.endM}
            onChange={(e) => set({ endM: numberValue(e.target.value) })}
            style={inputStyle}
          />
        </label>
      </div>

      {plan.error ? (
        <p role="alert" style={errorNoteStyle}>
          {plan.error}
        </p>
      ) : (
        <p style={noteStyle} aria-live="polite">
          プレビュー：追加 {plan.creates.length}・削除 {plan.deletes.length}・移動 {plan.moves.length}・そのまま {plan.keeps.length}
          <br />
          出店者のいる区画は消さず、空き区画だけを削除します。
        </p>
      )}
      {unanchoredCount > 0 && (
        <p style={noteStyle}>
          この道の近くに、道の上の位置をまだ持たない区画が {unanchoredCount} 件あります。これらは区画分けの対象外です。
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onApply}
          disabled={!!plan.error || !hasChange}
          style={{ ...primaryButtonStyle, opacity: plan.error || !hasChange ? 0.45 : 1 }}
        >
          適用
        </button>
        <button type="button" onClick={onCancel} style={buttonStyle}>
          やめる
        </button>
      </div>
    </div>
  );
}
