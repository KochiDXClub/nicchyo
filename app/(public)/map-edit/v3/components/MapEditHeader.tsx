import type { MapSettingsLimits } from "../useMapEditData";

export function MapEditHeader({
  search,
  onSearchChange,
  occupiedCount,
  vacantCount,
  roadCount,
  landmarkCount,
  limits,
  onToggleHistory,
  onToggleImport,
  hasUnsavedChanges,
  isSaving,
  pendingCount,
  onSave,
  saveBlocked = false,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  occupiedCount: number;
  vacantCount: number;
  roadCount: number;
  landmarkCount: number;
  /** 空き区画・建物の上限（/admin/settings）。件数の横に「件数 / 上限」で出す */
  limits: MapSettingsLimits;
  onToggleHistory: () => void;
  /** 出店者 CSV の取り込みパネルを開く・閉じる */
  onToggleImport: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  pendingCount: number;
  onSave: () => void;
  /** true のとき保存できない（DB のマイグレーション前） */
  saveBlocked?: boolean;
}) {
  return (
    <header
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 20px",
        background: "#fff",
        borderBottom: "1px solid #EDE3CD",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
        <span style={{ fontSize: 17, fontWeight: 900 }}>マップ編集</span>
      </div>

      <div style={{ position: "relative", flex: 1, maxWidth: 360, minWidth: 150 }}>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="区画番号・出店者名・道・建物の名前で検索"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 13px",
            borderRadius: 11,
            border: "1px solid #E4D9BF",
            background: "#FDFBF5",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#7A7264" }}>
          <span>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{occupiedCount}</b> 出店
          </span>
          <span title={`空き区画の上限 ${limits.maxUnassignedShopMarkers}`}>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{vacantCount}</b>/{limits.maxUnassignedShopMarkers} 空き
          </span>
          <span>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{roadCount}</b> 道
          </span>
          <span title={`建物の上限 ${limits.maxLandmarks}`}>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{landmarkCount}</b>/{limits.maxLandmarks} 建物
          </span>
        </div>
        <span
          onClick={onToggleImport}
          style={{
            padding: "8px 13px",
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            background: "#fff",
            color: "#57503F",
            border: "1px solid #E7DDC4",
          }}
        >
          CSV取り込み
        </span>
        <span
          onClick={onToggleHistory}
          style={{
            padding: "8px 13px",
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            background: "#fff",
            color: "#57503F",
            border: "1px solid #E7DDC4",
          }}
        >
          変更履歴
        </span>
        <span
          onClick={saveBlocked ? undefined : onSave}
          title={saveBlocked ? "データベースの更新（マイグレーション）の適用待ちのため保存できません" : undefined}
          style={{
            padding: "9px 17px",
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 700,
            cursor: hasUnsavedChanges && !isSaving && !saveBlocked ? "pointer" : "default",
            opacity: saveBlocked ? 0.5 : 1,
            background: hasUnsavedChanges ? "#F59E0B" : "#F3E7CC",
            color: hasUnsavedChanges ? "#fff" : "#A8996F",
          }}
        >
          {saveBlocked
            ? "保存できません（DB更新待ち）"
            : isSaving
              ? "保存中..."
              : hasUnsavedChanges
                ? `変更を保存（${pendingCount}）`
                : "保存済み"}
        </span>
      </div>
    </header>
  );
}
