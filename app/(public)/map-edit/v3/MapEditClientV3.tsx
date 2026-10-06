"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import { distanceMeters, getRouteCenter } from "../../map/utils/mapRouteGeometry";
import type { MapRoutePoint, RoadKind } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, focusOfOperation, netChanges, type EditHistory, type EditOperation } from "./editHistory";
import { ROAD_KIND_DEFAULT_WIDTH, ROAD_KIND_LABELS, type CanvasHandlers, type EditableShop, type Selection, type Tool } from "./types";
import { useMapEditData } from "./useMapEditData";
import { useMapEditOperations } from "./useMapEditOperations";
import { useLaneKeyboardNavigation } from "./useLaneKeyboardNavigation";
import MapEditCanvasMapLibre from "./components/MapEditCanvasMapLibre";
import { MapEditHeader } from "./components/MapEditHeader";
import { SnapshotHistoryPanel } from "./components/SnapshotHistoryPanel";
import { SlotDetailPanel, RoadDetailPanel, RoadListPanel, LandmarkDetailPanel } from "./components/DetailPanels";
import PendingChangeLog from "./components/PendingChangeLog";
import RoadLaneView, { buildLaneRoadGroups, type LaneRoadGroup } from "./components/RoadLaneView";
import ToolPalette from "./components/ToolPalette";
import ToolHint from "./components/ToolHint";

const MAX_ZOOM_IDX = 2;
// 道を描いている途中、既存の点からこの距離（メートル）以内をクリックしたら
// その点にスナップして接続する
const POINT_SNAP_DISTANCE_METERS = 6;

// 公開マップ側（RoadOverlay.tsx / mapRouteDb.ts）が road_id・複数道の概念にまだ
// 未対応で、単一のグローバルroadHalfWidthMetersで全道路を描画している。
// この状態で新しい道（kind: "street" など）を追加保存すると、公開マップ上で
// 無関係な道同士が1本の道として繋がって描画されてしまう恐れがあるため、
// 公開マップ側の複数道対応が入るまで、新規の道の作成は一時的に無効化する
// （既存の道の編集・削除は対象外）
const isRoadCreationDisabled = true;

export default function MapEditClientV3() {
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  // 「この出店者を移動」で移動先の区画を選んでいる最中の、移動元の区画
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number }[]>([]);
  const [drawAxis, setDrawAxis] = useState<"h" | "v" | "free">("h");

  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<EditHistory>(EMPTY_HISTORY);
  const changes = useMemo(() => netChanges(history), [history]);
  const unsavedKeys = useMemo(() => new Set(changes.map((change) => `${change.kind}:${change.id}`)), [changes]);

  const [zoomIdx, setZoomIdx] = useState(1);
  const [focus, setFocus] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const data = useMapEditData({
    changes,
    onLoaded: () => setFocus({ x: 0, y: 0 }),
    clearPending: () => setHistory(EMPTY_HISTORY),
  });
  const { shops, roads, landmarks, projection, setMessage, hasUnsavedChanges } = data;

  const ops = useMapEditOperations({
    history,
    setHistory,
    shops,
    setShops: data.setShops,
    roads,
    setRoads: data.setRoads,
    landmarks,
    setLandmarks: data.setLandmarks,
    routeConfig: data.routeConfig,
    vendorOptions: data.vendorOptions,
    mapSettingsLimits: data.mapSettingsLimits,
    setMessage,
  });

  const selectedShop = useMemo(
    () => (selection?.kind === "slot" ? shops.find((s) => s.locationId === selection.id) ?? null : null),
    [shops, selection]
  );
  const selectedRoad = useMemo(
    () => (selection?.kind === "road" ? roads.find((r) => r.id === selection.id) ?? null : null),
    [roads, selection]
  );
  const selectedLandmark = useMemo(
    () => (selection?.kind === "landmark" ? landmarks.find((l) => l.key === selection.id) ?? null : null),
    [landmarks, selection]
  );

  // 取り消し・やり直しや削除で、選んでいた要素が消えたら選択を外す
  useEffect(() => {
    if (!selection) return;
    const exists =
      selection.kind === "slot" ? !!selectedShop : selection.kind === "road" ? !!selectedRoad : !!selectedLandmark;
    if (!exists) setSelection(null);
  }, [selection, selectedShop, selectedRoad, selectedLandmark]);

  const shopCounts = useMemo(() => {
    const occupied = shops.filter((s) => s.vendorId).length;
    return { occupied, vacant: shops.length - occupied };
  }, [shops]);

  // 区画レーン（下部の一覧）の並び順。レーン表示とキーボード/WASDナビゲーションの
  // 両方がこの同じ並び順を参照する（表示と操作の向きが食い違わないようにするため）
  const laneGroups: LaneRoadGroup[] = useMemo(
    () => buildLaneRoadGroups(shops, roads, ops.findNearestRoadId, projection),
    [shops, roads, ops.findNearestRoadId, projection]
  );

  const focusOn = useCallback(
    (point: { lat: number; lng: number }) => setFocus(projection.toLocal(point.lat, point.lng)),
    [projection]
  );

  // ── 道具の切り替え ──────────────────────────────
  /** 道具の途中の状態（描きかけの道・移動先選び）を捨てて、選択ツールに戻る */
  const backToSelect = useCallback(() => {
    setTool("select");
    setDraft([]);
    setMoveSourceId(null);
  }, []);

  const changeTool = useCallback(
    (next: Tool) => {
      setDraft([]);
      setMoveSourceId(null);
      setTool(next);
      // 描いている道の頂点ハンドルと接続先の点が重なって紛らわしくならないよう、
      // 選択ツール以外に切り替えるときは道の選択を外す
      if (next !== "select") setSelection((prev) => (prev?.kind === "road" ? null : prev));
    },
    []
  );

  // ── 選択 ──────────────────────────────
  const selectShop = useCallback(
    (locationId: string) => {
      if (moveSourceId && moveSourceId !== locationId) {
        const target = shops.find((s) => s.locationId === locationId);
        if (target && !target.vendorId) {
          ops.moveVendor(moveSourceId, locationId);
        } else {
          setMessage("移動先には空き区画を選んでください。");
        }
        setMoveSourceId(null);
      }
      setSelection({ kind: "slot", id: locationId });
    },
    [moveSourceId, shops, ops, setMessage]
  );

  // 下部の区画レーンで店舗名をタップした時・キーボードで移動した時は、選択に加えて
  // 地図側もその区画の位置へ移動する
  const selectShopAndFocus = useCallback(
    (shop: EditableShop) => {
      selectShop(shop.locationId);
      focusOn(shop);
    },
    [selectShop, focusOn]
  );

  const selectRoad = useCallback(
    (roadId: string) => {
      if (tool === "splitSlots") {
        // 区画分けツールの本体はフェーズ3で追加する。ここでは対象の道を選ぶところまで
        const road = roads.find((r) => r.id === roadId);
        if (road?.kind !== "market") {
          setMessage("区画分けは「出店可の通り」でだけ使えます。");
          return;
        }
        setTool("select");
      }
      setSelection({ kind: "road", id: roadId });
    },
    [tool, roads, setMessage]
  );

  // 道の一覧で名前をタップした時は、選択に加えて地図側もその道の位置へ移動する
  const selectRoadFromList = useCallback(
    (roadId: string) => {
      selectRoad(roadId);
      const road = roads.find((r) => r.id === roadId);
      if (road && road.points.length > 0) {
        const [lat, lng] = getRouteCenter(road.points);
        focusOn({ lat, lng });
      }
    },
    [selectRoad, roads, focusOn]
  );

  // ── 道を描く ──────────────────────────────
  // 道を新規作成中、既存の道の点の近くをクリックしたらその点にぴったり
  // つなげられるようにする（道同士が交差・合流する見た目を作れるようにするため）
  const findNearestRoutePoint = useCallback(
    (point: { lat: number; lng: number }): MapRoutePoint | null => {
      let nearest: MapRoutePoint | null = null;
      let bestDistance = Infinity;
      for (const road of roads) {
        for (const p of road.points) {
          const d = distanceMeters(point, p);
          if (d < bestDistance) {
            bestDistance = d;
            nearest = p;
          }
        }
      }
      return bestDistance <= POINT_SNAP_DISTANCE_METERS ? nearest : null;
    },
    [roads]
  );

  const finishDraw = useCallback(
    (pointsOverride?: { lat: number; lng: number }[]) => {
      const id = ops.createRoad(pointsOverride ?? draft);
      if (!id) return;
      backToSelect();
      setSelection({ kind: "road", id });
    },
    [ops, draft, backToSelect]
  );

  const handleDrawClick = useCallback(
    (lat: number, lng: number) => {
      // 既存の道の点の近くをクリックした場合は、座標をその点にぴったり合わせて
      // つなげる（軸ロックより優先し、明示的な接続の意図をそのまま反映する）
      const snapped = findNearestRoutePoint({ lat, lng });
      const nextLat = snapped ? snapped.lat : lat;
      const nextLng = snapped ? snapped.lng : lng;

      // すでに新しい点を打ってある状態で既存の点をクリックしたら、その場でつなげて道を確定する
      if (snapped && draft.length >= 1) {
        finishDraw([...draft, { lat: nextLat, lng: nextLng }]);
        return;
      }

      setDraft((prev) => {
        const first = prev[0];
        let pointLat = nextLat;
        let pointLng = nextLng;
        if (!snapped && first && drawAxis === "h") pointLat = first.lat;
        if (!snapped && first && drawAxis === "v") pointLng = first.lng;
        return [...prev, { lat: pointLat, lng: pointLng }];
      });
    },
    [findNearestRoutePoint, draft, drawAxis, finishDraw]
  );

  // ── 取り消し・やり直し・キーボード ──────────────────────────────
  // Ctrl+Z / Ctrl+Shift+Z（Mac は Cmd）。入力欄の中では文字入力の取り消しを優先して反応しない
  const shortcuts = useMemo(
    () => [
      { key: "z", ctrl: true, description: "直前の操作を取り消す", action: ops.undo },
      { key: "z", ctrl: true, shift: true, description: "取り消した操作をやり直す", action: ops.redo },
    ],
    [ops.undo, ops.redo]
  );
  useKeyboardShortcuts(shortcuts);

  // Esc: 道具の途中なら中断して選択ツールへ。選択ツールなら選択を外す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (tool !== "select" || moveSourceId) backToSelect();
      else {
        // 名前や検索の入力欄で Esc を押しても、詳細パネルごと閉じない（入力の取り消しに使われるため）
        const target = e.target;
        const isFormField =
          target instanceof HTMLElement &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable);
        if (!isFormField) setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, moveSourceId, backToSelect]);

  useLaneKeyboardNavigation({
    // 「この出店者を移動」で移動先を選んでいるあいだは、矢印キーで出店者が移らないようにする
    enabled: tool === "select" && !moveSourceId,
    selectedShop,
    shops,
    laneGroups,
    onMove: selectShopAndFocus,
  });

  useUnsavedChangesWarning(hasUnsavedChanges, {
    confirmOnLinkClick: true,
    message: "保存していない変更があります。このページを離れると変更は失われます。移動しますか？",
  });

  // 変更一覧の行をクリックしたら、その操作の対象の位置へ地図を寄せる
  const focusOperation = useCallback(
    (operation: EditOperation) => {
      const point = focusOfOperation(operation);
      if (point) focusOn(point);
    },
    [focusOn]
  );

  // ── 地図からの操作 ──────────────────────────────
  const canvasHandlers: CanvasHandlers = {
    onSelectShop: selectShop,
    onSelectRoad: selectRoad,
    onSelectLandmark: (key) => setSelection({ kind: "landmark", id: key }),
    onMoveLandmark: ops.moveLandmarkLive,
    onMoveLandmarkEnd: ops.moveLandmarkEnd,
    // 地図の空白部分クリック時の挙動は、今の道具によって変わる
    onMapClick: (lat, lng) => {
      if (tool === "drawRoad") {
        handleDrawClick(lat, lng);
        return;
      }
      if (tool === "placeLandmark") {
        const key = ops.addLandmark(lat, lng);
        backToSelect();
        if (key) setSelection({ kind: "landmark", id: key });
        return;
      }
      if (tool === "select" && !moveSourceId) setSelection(null);
    },
    onVertexMove: ops.moveVertexLive,
    onVertexMoveEnd: ops.moveVertexEnd,
    onVertexRemove: ops.removeVertex,
    onMidpointInsert: ops.insertVertex,
  };

  const toolHintMessage =
    moveSourceId
      ? "移動先の空き区画をクリック（地図か下の区画レーン）。Escで中断"
      : tool === "drawRoad"
        ? `クリックで点を追加（${drawAxis === "h" ? "横向き" : drawAxis === "v" ? "縦向き" : "自由"}）。既存の点をクリックするとつながって確定、Escで中断`
        : tool === "splitSlots"
          ? "区画を割り振る「出店可の通り」をクリック。Escで中断"
          : tool === "placeLandmark"
            ? "建物を置く場所をクリック。Escで中断"
            : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        background: "#FBF7EE",
        color: "#33302B",
        overflow: "hidden",
      }}
    >
      <MapEditHeader
        search={search}
        onSearchChange={setSearch}
        occupiedCount={shopCounts.occupied}
        vacantCount={shopCounts.vacant}
        roadCount={roads.length}
        landmarkCount={landmarks.length}
        limits={data.mapSettingsLimits}
        onToggleHistory={() => data.setIsHistoryOpen((v) => !v)}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={data.isSaving}
        pendingCount={history.past.length}
        onSave={() => void data.handleSave()}
      />

      {data.message && (
        <div style={{ padding: "8px 20px", background: "#FFF7E6", color: "#92400E", fontSize: 12.5, borderBottom: "1px solid #EDE3CD" }}>
          {data.message}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex" }}>
            <MapEditCanvasMapLibre
              tool={tool}
              selection={selection}
              isPickingTarget={!!moveSourceId}
              unsavedKeys={unsavedKeys}
              shops={shops}
              roads={roads}
              landmarks={landmarks}
              draft={draft}
              search={search}
              zoomIdx={zoomIdx}
              setZoomIdx={setZoomIdx}
              focus={focus}
              setFocus={setFocus}
              rotation={rotation}
              setRotation={setRotation}
              projection={projection}
              handlers={canvasHandlers}
              isLoading={data.isLoading}
              onZoomIn={() => setZoomIdx((prev) => Math.min(MAX_ZOOM_IDX, prev + 1))}
              onZoomOut={() => setZoomIdx((prev) => Math.max(0, prev - 1))}
            />
            <div style={{ position: "absolute", top: 12, left: 12 }}>
              <ToolPalette
                tool={tool}
                onChange={changeTool}
                disabled={{
                  // isRoadCreationDisabled の理由はファイル冒頭の定義部コメント参照
                  ...(isRoadCreationDisabled
                    ? { drawRoad: "公開マップ側の複数道対応が完了するまで、新しい道の追加は一時的に無効化しています" }
                    : {}),
                }}
              />
            </div>
            {toolHintMessage && (
              <div style={{ position: "absolute", top: 12, left: 180, right: 12, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ pointerEvents: "auto" }}>
                  <ToolHint message={toolHintMessage} onCancel={backToSelect}>
                    {tool === "drawRoad" && draft.length >= 2 && (
                      <button type="button" onClick={() => finishDraw()} style={{ padding: "4px 10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>
                        この形で確定
                      </button>
                    )}
                    {tool === "drawRoad" && (
                      <select
                        aria-label="描く向き"
                        value={drawAxis}
                        onChange={(e) => setDrawAxis(e.target.value as "h" | "v" | "free")}
                        style={{ padding: "3px 6px", borderRadius: 8, border: "none", fontWeight: 700 }}
                      >
                        <option value="h">横向き</option>
                        <option value="v">縦向き</option>
                        <option value="free">自由</option>
                      </select>
                    )}
                  </ToolHint>
                </div>
              </div>
            )}
          </div>
          {selection?.kind === "slot" && (
            <RoadLaneView
              groups={laneGroups}
              selectedLocationId={selection.id}
              isPickingTarget={!!moveSourceId}
              search={search}
              onSelectShop={(locationId) => {
                const shop = shops.find((s) => s.locationId === locationId);
                if (shop) selectShopAndFocus(shop);
              }}
            />
          )}
        </div>

        <aside
          style={{
            width: 320,
            flexShrink: 0,
            minHeight: 0,
            background: "#fff",
            borderLeft: "1px solid #EDE3CD",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {data.isHistoryOpen ? (
            <SnapshotHistoryPanel
              snapshots={data.snapshots}
              isLoadingSnapshots={data.isLoadingSnapshots}
              isRestoring={data.isRestoring}
              hasUnsavedChanges={hasUnsavedChanges}
              onClose={() => data.setIsHistoryOpen(false)}
              onRestore={(id) => void data.handleRestoreSnapshot(id)}
            />
          ) : (
            <>
              {(!selection || selection.kind === "road") && (
                <RoadListPanel
                  roads={roads}
                  selectedRoadId={selectedRoad?.id ?? null}
                  search={search}
                  onSelectRoad={selectRoadFromList}
                />
              )}
              {!selection && (
                <p style={{ margin: 0, padding: 16, fontSize: 12.5, color: "#9A8A6A" }}>
                  地図上の道・区画・建物をクリックすると、ここに詳細が出ます。
                </p>
              )}
              {selectedShop && (
                <SlotDetailPanel
                  shop={selectedShop}
                  vendorOptions={data.vendorOptions}
                  onVendorSelect={(vendorId) => ops.assignVendor(selectedShop.locationId, vendorId)}
                  onStartMove={() => {
                    setTool("select");
                    setMoveSourceId(selectedShop.locationId);
                  }}
                  onClearVendor={() => ops.clearVendor(selectedShop.locationId)}
                />
              )}
              {selectedRoad && (
                <RoadDetailPanel
                  road={selectedRoad}
                  onNameChange={(value) =>
                    ops.patchRoad(selectedRoad.id, { name: value }, "の名前を変更", { coalesceKey: `road-name:${selectedRoad.id}` })
                  }
                  onKindChange={(kind: RoadKind) =>
                    ops.patchRoad(
                      selectedRoad.id,
                      { kind, widthMeters: ROAD_KIND_DEFAULT_WIDTH[kind] },
                      `を${ROAD_KIND_LABELS[kind]}に変更`
                    )
                  }
                  onWiderClick={() =>
                    ops.patchRoad(selectedRoad.id, { widthMeters: Math.min(90, selectedRoad.widthMeters + 4) }, "の道幅を変更")
                  }
                  onNarrowerClick={() =>
                    ops.patchRoad(selectedRoad.id, { widthMeters: Math.max(8, selectedRoad.widthMeters - 4) }, "の道幅を変更")
                  }
                  onDelete={() => {
                    if (ops.deleteRoad(selectedRoad.id)) setSelection(null);
                  }}
                  onAddSlots={(count) => ops.addSlotsToRoad(selectedRoad, count)}
                  shopCountOnRoad={ops.shopCountOnRoad}
                />
              )}
              {selectedLandmark && (
                <LandmarkDetailPanel
                  landmark={selectedLandmark}
                  onNameChange={(value) =>
                    ops.patchLandmark(selectedLandmark.key, { name: value }, "の名前を変更", {
                      coalesceKey: `landmark-name:${selectedLandmark.key}`,
                    })
                  }
                  onDescriptionChange={(value) =>
                    ops.patchLandmark(selectedLandmark.key, { description: value }, "の説明を変更", {
                      coalesceKey: `landmark-description:${selectedLandmark.key}`,
                    })
                  }
                  onDelete={() => ops.deleteLandmark(selectedLandmark.key)}
                />
              )}

              <PendingChangeLog
                operations={history.past}
                canRedo={history.future.length > 0}
                onUndo={ops.undo}
                onRedo={ops.redo}
                onSelect={focusOperation}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
