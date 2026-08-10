"use client";

import type { PendingChange } from "./types";

export default function PendingChangeLog({
  pending,
  onUndo,
}: {
  pending: PendingChange[];
  onUndo: () => void;
}) {
  return (
    <div style={{ padding: 16, marginTop: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 900, color: "#57503F" }}>変更履歴（未保存 {pending.length}）</span>
        {pending.length > 0 && (
          <span onClick={onUndo} style={{ fontSize: 11.5, fontWeight: 700, color: "#B4472C", cursor: "pointer" }}>
            直前を取り消す
          </span>
        )}
      </div>
      {pending.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "#B5AA92", margin: 0 }}>まだ変更はありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
          {pending.map((change) => (
            <div key={change.id} style={{ fontSize: 11.5, color: "#7A7264", lineHeight: 1.5 }}>
              <b style={{ color: "#57503F" }}>{change.label}</b> {change.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
