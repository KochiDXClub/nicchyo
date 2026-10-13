"use client";

import type { EditableLandmark, EditableRoad, RoadKind } from "../types";
import { ROAD_KIND_LABELS } from "../types";
import { buttonStyle, dangerButtonStyle, inputStyle, label, panelWrap } from "./panelStyles";

/** 道の一覧。何も選んでいないときと、道を選んでいるときに右パネルの上に出す */
export function RoadListPanel({
  roads,
  selectedRoadId,
  search,
  onSelectRoad,
}: {
  roads: EditableRoad[];
  selectedRoadId: string | null;
  search: string;
  onSelectRoad: (roadId: string) => void;
}) {
  const q = search.trim().toLowerCase();
  const list = roads.filter((r) => !q || r.name.toLowerCase().includes(q));

  return (
    <div style={panelWrap}>
      <span style={label}>道の一覧（{list.length}）</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
        {list.map((r) => (
          <span
            key={r.id}
            onClick={() => onSelectRoad(r.id)}
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: selectedRoadId === r.id ? "#FFF3DA" : "transparent",
              color: selectedRoadId === r.id ? "#92400E" : "#57503F",
            }}
          >
            {r.name}（{ROAD_KIND_LABELS[r.kind]}）
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoadDetailPanel({
  road,
  onNameChange,
  onKindChange,
  onWiderClick,
  onNarrowerClick,
  onDelete,
  onStartSplit,
  shopCountOnRoad,
}: {
  road: EditableRoad;
  onNameChange: (value: string) => void;
  onKindChange: (kind: RoadKind) => void;
  onWiderClick: () => void;
  onNarrowerClick: () => void;
  onDelete: () => void;
  /** 区画分けツールをこの道で始める */
  onStartSplit: () => void;
  shopCountOnRoad: (roadId: string) => number;
}) {
  return (
    <div style={panelWrap}>
      <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900 }}>{road.name}</p>

      <span style={label}>名称</span>
      <input value={road.name} onChange={(e) => onNameChange(e.target.value)} style={inputStyle} />

      <span style={label}>種別</span>
      <select
        value={road.kind}
        onChange={(e) => onKindChange(e.target.value as RoadKind)}
        style={inputStyle}
      >
        {(Object.keys(ROAD_KIND_LABELS) as RoadKind[]).map((kind) => (
          <option key={kind} value={kind}>
            {ROAD_KIND_LABELS[kind]}
          </option>
        ))}
      </select>

      <span style={label}>道幅（{road.widthMeters}m）</span>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <span onClick={onNarrowerClick} style={buttonStyle}>
          － 狭く
        </span>
        <span onClick={onWiderClick} style={buttonStyle}>
          ＋ 広く
        </span>
      </div>

      <p style={{ fontSize: 11.5, color: "#9A8A6A", margin: "0 0 12px" }}>
        地図上の点はドラッグで移動、ダブルクリックで削除、線の中点クリックで追加できます。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span onClick={onDelete} style={dangerButtonStyle}>
          道を削除
        </span>
      </div>

      {road.kind === "market" && (
        <>
          <span style={label}>区画（現在 {shopCountOnRoad(road.id)} 区画）</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onStartSplit} style={buttonStyle}>
              区画分け…
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function LandmarkDetailPanel({
  landmark,
  onNameChange,
  onDescriptionChange,
  onDelete,
}: {
  landmark: EditableLandmark | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDelete: () => void;
}) {
  if (!landmark) {
    return (
      <div style={panelWrap}>
        <p style={{ fontSize: 12.5, color: "#9A8A6A", margin: 0 }}>
          建物を選択してください。（地図上でドラッグして移動できます）
        </p>
      </div>
    );
  }

  return (
    <div style={panelWrap}>
      <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900 }}>{landmark.name}</p>

      <span style={label}>名称</span>
      <input value={landmark.name} onChange={(e) => onNameChange(e.target.value)} style={inputStyle} />

      <span style={label}>説明</span>
      <textarea
        value={landmark.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      <span onClick={onDelete} style={dangerButtonStyle}>
        建物を削除
      </span>
    </div>
  );
}
