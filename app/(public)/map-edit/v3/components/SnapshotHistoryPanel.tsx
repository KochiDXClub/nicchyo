import type { SnapshotItem } from "../types";

export function SnapshotHistoryPanel({
  snapshots,
  isLoadingSnapshots,
  isRestoring,
  hasUnsavedChanges,
  onClose,
  onRestore,
}: {
  snapshots: SnapshotItem[];
  isLoadingSnapshots: boolean;
  isRestoring: string | null;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onRestore: (snapshotId: string) => void;
}) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>変更履歴（スナップショット）</span>
        <span onClick={onClose} style={{ cursor: "pointer", fontSize: 12, color: "#9A8A6A" }}>
          閉じる
        </span>
      </div>
      {isLoadingSnapshots ? (
        <p style={{ fontSize: 12, color: "#9A8A6A" }}>読み込み中...</p>
      ) : snapshots.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9A8A6A" }}>スナップショットはまだありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {snapshots.map((snap) => (
            <div key={snap.id} style={{ border: "1px solid #F3EBD8", borderRadius: 10, padding: 10 }}>
              <p style={{ margin: 0, fontSize: 11.5, color: "#9A8A6A" }}>
                {new Date(snap.created_at).toLocaleString("ja-JP")}
              </p>
              <span
                onClick={() => onRestore(snap.id)}
                style={{
                  marginTop: 6,
                  display: "inline-block",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#92400E",
                  cursor: hasUnsavedChanges || isRestoring ? "default" : "pointer",
                  opacity: hasUnsavedChanges || isRestoring ? 0.4 : 1,
                }}
              >
                {isRestoring === snap.id ? "復元中..." : "この状態に復元"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
