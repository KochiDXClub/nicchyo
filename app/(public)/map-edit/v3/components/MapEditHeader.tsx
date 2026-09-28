import type { Tab } from "../types";

export function MapEditHeader({
  tab,
  onTabChange,
  search,
  onSearchChange,
  occupiedCount,
  vacantCount,
  roadCount,
  onToggleHistory,
  hasUnsavedChanges,
  isSaving,
  pendingCount,
  onSave,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  search: string;
  onSearchChange: (value: string) => void;
  occupiedCount: number;
  vacantCount: number;
  roadCount: number;
  onToggleHistory: () => void;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  pendingCount: number;
  onSave: () => void;
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

      <div style={{ display: "flex", border: "1px solid #E4D9BF", borderRadius: 11, overflow: "hidden", flexShrink: 0 }}>
        {(["slot", "road", "landmark"] as Tab[]).map((t) => (
          <span
            key={t}
            onClick={() => onTabChange(t)}
            style={{
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: tab === t ? "#92400E" : "#fff",
              color: tab === t ? "#fff" : "#57503F",
              whiteSpace: "nowrap",
            }}
          >
            {t === "slot" ? "店舗位置を編集" : t === "road" ? "道を編集" : "建物を編集"}
          </span>
        ))}
      </div>

      <div style={{ position: "relative", flex: 1, maxWidth: 360, minWidth: 150 }}>
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={
            tab === "road" ? "道の名称で検索" : tab === "landmark" ? "建物の名称で検索" : "区画番号・出店者名で検索"
          }
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
          <span>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{vacantCount}</b> 空き
          </span>
          <span>
            <b style={{ fontSize: 13.5, color: "#33302B" }}>{roadCount}</b> 道
          </span>
        </div>
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
          onClick={onSave}
          style={{
            padding: "9px 17px",
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 700,
            cursor: hasUnsavedChanges && !isSaving ? "pointer" : "default",
            background: hasUnsavedChanges ? "#F59E0B" : "#F3E7CC",
            color: hasUnsavedChanges ? "#fff" : "#A8996F",
          }}
        >
          {isSaving ? "保存中..." : hasUnsavedChanges ? `変更を保存（${pendingCount}）` : "保存済み"}
        </span>
      </div>
    </header>
  );
}
