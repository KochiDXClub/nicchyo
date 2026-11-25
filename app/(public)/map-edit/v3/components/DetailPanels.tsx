"use client";

import { useState } from "react";
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

/** 道の上に名前付きの出店場所を1つ追加する入力欄（保存は地図の保存でまとめて行う） */
function PlaceAddForm({ onAddPlace }: { onAddPlace: (name: string) => boolean }) {
  const [name, setName] = useState("");
  return (
    <div style={{ marginTop: 12 }}>
      <span style={label}>出店場所を追加</span>
      <input
        aria-label="出店場所の名前"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例：広場の出店場所"
        style={inputStyle}
      />
      <button
        type="button"
        style={{ ...buttonStyle, marginTop: 6 }}
        disabled={!name.trim()}
        onClick={() => {
          if (onAddPlace(name)) setName("");
        }}
      >
        この道に出店場所を追加
      </button>
    </div>
  );
}

export function RoadDetailPanel({
  road,
  onAddPlace,
  onNameChange,
  onKindChange,
  markets,
  onMarketChange,
  onWiderClick,
  onNarrowerClick,
  onDelete,
  shopCountOnRoad,
}: {
  road: EditableRoad;
  onNameChange: (value: string) => void;
  onKindChange: (kind: RoadKind) => void;
  markets: { id: string; slug: string; name: string }[];
  onMarketChange: (id: string) => void;
  onWiderClick: () => void;
  onNarrowerClick: () => void;
  onDelete: () => void;
  shopCountOnRoad: (roadId: string) => number;
  /** 名前付きの出店場所を、この道に1つ追加する（道を選んでいるときだけ出す） */
  onAddPlace?: (name: string) => boolean;
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

      {onAddPlace && <PlaceAddForm onAddPlace={onAddPlace} />}

      {markets.length > 1 && (
        <label style={label}>
          所属する市
          <select
            value={road.marketId ?? markets.find((market) => market.slug === "nichiyo")?.id ?? ""}
            onChange={(event) => onMarketChange(event.target.value)}
            disabled={shopCountOnRoad(road.id) > 0}
            style={inputStyle}
          >
            {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
          </select>
        </label>
      )}

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
