"use client";

import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  RoadKind,
  VendorOption,
} from "../types";
import { ROAD_KIND_LABELS } from "../types";
import { buttonStyle, dangerButtonStyle, inputStyle, label, noteStyle, panelWrap } from "./panelStyles";

export function SlotDetailPanel({
  shop,
  roadName,
  vendorOptions,
  onVendorSelect,
  onStartMove,
  onClearVendor,
  onDelete,
}: {
  shop: EditableShop | null;
  /** 区画が乗っている道の名前（道基準の位置を持つ区画だけ） */
  roadName: string | null;
  vendorOptions: VendorOption[];
  onVendorSelect: (vendorId: string) => void;
  onStartMove: () => void;
  onClearVendor: () => void;
  onDelete: () => void;
}) {
  if (!shop) {
    return (
      <div style={panelWrap}>
        <p style={{ fontSize: 12.5, color: "#9A8A6A", margin: 0 }}>区画を選択してください。</p>
      </div>
    );
  }

  return (
    <div style={panelWrap}>
      <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 900 }}>区画 {shop.position}</p>
      <p style={{ ...noteStyle, marginBottom: 12 }}>
        {shop.roadId && shop.roadDistanceM != null
          ? `${roadName ?? "道"} の${shop.roadSide === "left" ? "左" : "右"}側・始点から ${Math.round(shop.roadDistanceM)}m`
          : "道の上の位置はまだありません（移行前の区画）"}
      </p>

      <span style={label}>出店者（登録済みから選択）</span>
      <select
        value={shop.vendorId ?? ""}
        onChange={(e) => onVendorSelect(e.target.value)}
        style={inputStyle}
      >
        <option value="">（空き）</option>
        {vendorOptions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      {/* 表示名は出店者データの店名から決まる（区画側では保存されない）ため、ここでは表示だけにする */}
      <span style={label}>表示名</span>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}>{shop.name}</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span onClick={onStartMove} style={buttonStyle}>
          この出店者を移動
        </span>
        {shop.vendorId && (
          <span onClick={onClearVendor} style={dangerButtonStyle}>
            空きにする
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!!shop.vendorId}
          title={shop.vendorId ? "出店者がいる区画は削除できません。先に「空きにする」で出店者を外してください" : undefined}
          style={{ ...dangerButtonStyle, opacity: shop.vendorId ? 0.45 : 1, cursor: shop.vendorId ? "not-allowed" : "pointer" }}
        >
          この区画を削除
        </button>
      </div>
      {shop.vendorId && <p style={{ ...noteStyle, marginTop: 8 }}>区画を削除するには、先に「空きにする」で出店者を外してください。</p>}
    </div>
  );
}

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
