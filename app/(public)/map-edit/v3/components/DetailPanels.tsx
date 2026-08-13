"use client";

import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  RoadKind,
  VendorOption,
} from "../types";
import { ROAD_KIND_LABELS } from "../types";

const panelWrap: React.CSSProperties = { padding: 16, borderBottom: "1px solid #F3EBD8" };
const label: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#9A8A6A", marginBottom: 5 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 11px",
  borderRadius: 9,
  border: "1px solid #E4D9BF",
  background: "#FDFBF5",
  fontSize: 13,
  outline: "none",
  marginBottom: 12,
};
const buttonStyle: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 9,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid #E4D9BF",
  background: "#fff",
  color: "#57503F",
};
const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: "1px solid #F2C4B0",
  color: "#B4472C",
};

export function SlotDetailPanel({
  shop,
  vendorOptions,
  onVendorNameChange,
  onVendorSelect,
  onStartMove,
  onClearVendor,
}: {
  shop: EditableShop | null;
  vendorOptions: VendorOption[];
  onVendorNameChange: (value: string) => void;
  onVendorSelect: (vendorId: string) => void;
  onStartMove: () => void;
  onClearVendor: () => void;
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
      <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 900 }}>区画 {shop.position}</p>

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

      <span style={label}>表示名</span>
      <input
        value={shop.name}
        onChange={(e) => onVendorNameChange(e.target.value)}
        style={inputStyle}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span onClick={onStartMove} style={buttonStyle}>
          この出店者を移動
        </span>
        {shop.vendorId && (
          <span onClick={onClearVendor} style={dangerButtonStyle}>
            空きにする
          </span>
        )}
      </div>
    </div>
  );
}

export function RoadDetailPanel({
  road,
  roads,
  search,
  onSelectRoad,
  onNameChange,
  onKindChange,
  onWiderClick,
  onNarrowerClick,
  onDelete,
  onAddSlots,
  shopCountOnRoad,
}: {
  road: EditableRoad | null;
  roads: EditableRoad[];
  search: string;
  onSelectRoad: (roadId: string) => void;
  onNameChange: (value: string) => void;
  onKindChange: (kind: RoadKind) => void;
  onWiderClick: () => void;
  onNarrowerClick: () => void;
  onDelete: () => void;
  onAddSlots: (count: number) => void;
  shopCountOnRoad: (roadId: string) => number;
}) {
  const q = search.trim().toLowerCase();
  const list = roads.filter((r) => !q || r.name.toLowerCase().includes(q));

  return (
    <div>
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
                background: road?.id === r.id ? "#FFF3DA" : "transparent",
                color: road?.id === r.id ? "#92400E" : "#57503F",
              }}
            >
              {r.name}（{ROAD_KIND_LABELS[r.kind]}）
            </span>
          ))}
        </div>
      </div>

      {!road ? (
        <div style={panelWrap}>
          <p style={{ fontSize: 12.5, color: "#9A8A6A", margin: 0 }}>道を選択してください。</p>
        </div>
      ) : (
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
                <span onClick={() => onAddSlots(2)} style={buttonStyle}>
                  ＋2 区画
                </span>
                <span onClick={() => onAddSlots(10)} style={buttonStyle}>
                  ＋10 区画
                </span>
              </div>
            </>
          )}
        </div>
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
