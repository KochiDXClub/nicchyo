import type { RoadAction, SlotAction } from "../types";

/** slot/road のアクション中だけ出る、状態の説明とキャンセルの帯 */
export function MapEditModeBanner({
  slotAction,
  roadAction,
  drawAxis,
  onDrawAxisChange,
  draftLength,
  onFinishDraw,
  onCancel,
}: {
  slotAction: SlotAction;
  roadAction: RoadAction;
  drawAxis: "h" | "v" | "free";
  onDrawAxisChange: (axis: "h" | "v" | "free") => void;
  draftLength: number;
  onFinishDraw: () => void;
  onCancel: () => void;
}) {
  if (slotAction === "idle" && roadAction === "idle") return null;

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 20px",
        background: "#92400E",
        color: "#fff",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700 }}>
        {slotAction === "move"
          ? "移動先の空き区画をクリックしてください"
          : slotAction === "place"
            ? "新規出店者を置く空き区画をクリックしてください"
            : `地図をクリックして道を伸ばしてください（${drawAxis === "h" ? "横向き" : drawAxis === "v" ? "縦向き" : "自由"}・既存の点をクリックするとそこにつながって道が確定します）`}
      </span>
      {roadAction === "draw" && (
        <div style={{ display: "flex", gap: 5 }}>
          {(["h", "v", "free"] as const).map((axis) => (
            <span
              key={axis}
              onClick={() => onDrawAxisChange(axis)}
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: drawAxis === axis ? "#fff" : "rgba(255,255,255,.16)",
                color: drawAxis === axis ? "#92400E" : "#fff",
              }}
            >
              {axis === "h" ? "横向き" : axis === "v" ? "縦向き" : "自由"}
            </span>
          ))}
        </div>
      )}
      {roadAction === "draw" && draftLength >= 2 && (
        <span
          onClick={onFinishDraw}
          style={{ fontSize: 12.5, fontWeight: 700, background: "#fff", color: "#92400E", borderRadius: 9, padding: "5px 12px", cursor: "pointer" }}
        >
          この形で確定
        </span>
      )}
      <span
        onClick={onCancel}
        style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, border: "1px solid rgba(255,255,255,.5)", borderRadius: 9, padding: "5px 11px", cursor: "pointer" }}
      >
        キャンセル (Esc)
      </span>
    </div>
  );
}
