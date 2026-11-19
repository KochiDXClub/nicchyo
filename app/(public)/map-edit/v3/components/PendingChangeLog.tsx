"use client";

import type { EditOperation } from "../editHistory";

// 見出し・「やり直す」・各行の見出し語で同じ色を使う
const INK = "#57503F";
const actionStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, cursor: "pointer", border: 0, background: "transparent", padding: "8px 0" };

export default function PendingChangeLog({
  operations,
  canRedo,
  onUndo,
  onRedo,
  onSelect,
}: {
  /** 記録済みの操作（古い順）。表示は新しい順 */
  operations: EditOperation[];
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** 行をクリックしたとき（地図をその操作の対象へ寄せる） */
  onSelect: (operation: EditOperation) => void;
}) {
  const newestFirst = [...operations].reverse();

  return (
    <div style={{ padding: 16, marginTop: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 900, color: INK }}>変更履歴（未保存 {operations.length}）</span>
        <div style={{ display: "flex", gap: 10 }}>
          {operations.length > 0 && (
            <button type="button" onClick={onUndo} title="Ctrl+Z（Mac は ⌘Z）" style={{ ...actionStyle, color: "#B4472C" }}>
              直前を取り消す
            </button>
          )}
          {canRedo && (
            <button type="button" onClick={onRedo} title="Ctrl+Shift+Z（Mac は ⌘⇧Z）" style={{ ...actionStyle, color: INK }}>
              やり直す
            </button>
          )}
        </div>
      </div>
      {operations.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "#B5AA92", margin: 0 }}>まだ変更はありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 220, overflowY: "auto" }}>
          {newestFirst.map((operation) => (
            <button
              key={operation.id}
              type="button"
              onClick={() => onSelect(operation)}
              title="地図でこの場所を表示"
              style={{ fontSize: 11.5, color: "#7A7264", lineHeight: 1.5, cursor: "pointer", padding: "6px 4px", borderRadius: 6, border: 0, background: "transparent", textAlign: "left" }}
            >
              <b style={{ color: INK }}>{operation.label}</b> {operation.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
