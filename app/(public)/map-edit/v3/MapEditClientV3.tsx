"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import { distanceMeters, getRouteCenter } from "../../map/utils/mapRouteGeometry";
import { resolveSlotPositions, roadLengthMeters, roadSlotLatLng } from "@/lib/map/roadSlotPosition";
import type { MapRoutePoint, RoadKind } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, focusOfOperation, netChanges, type EditHistory, type EditOperation } from "./editHistory";
import { ROAD_KIND_DEFAULT_WIDTH, ROAD_KIND_LABELS, type CanvasHandlers, type EditableShop, type Selection, type Tool } from "./types";
import { useMapEditData } from "./useMapEditData";
import { newSlotOffsetM, useMapEditOperations } from "./useMapEditOperations";
import { initialSplitSettings, planRoadSlots, type SlotOnRoad, type SlotSplitSettings } from "./slotSplitPlan";
import { useLaneKeyboardNavigation } from "./useLaneKeyboardNavigation";
import MapEditCanvasMapLibre from "./components/MapEditCanvasMapLibre";
import { MapEditHeader } from "./components/MapEditHeader";
import { SnapshotHistoryPanel } from "./components/SnapshotHistoryPanel";
import { RoadDetailPanel, RoadListPanel, LandmarkDetailPanel } from "./components/DetailPanels";
import SlotVendorPanel from "./components/SlotVendorPanel";
import PendingChangeLog from "./components/PendingChangeLog";
import RoadLaneView, { buildLaneRoadGroups, type LaneRoadGroup } from "./components/RoadLaneView";
import ToolPalette from "./components/ToolPalette";
import ToolHint from "./components/ToolHint";
import SlotSplitPanel from "./components/SlotSplitPanel";
import SlotMigrationPanel from "./components/SlotMigrationPanel";
import StoreImportPanel from "./components/StoreImportPanel";

const MAX_ZOOM_IDX = 2;
// 道を描いている途中、既存の点からこの距離（メートル）以内をクリックしたら
// その点に位置を合わせる（道同士が交差・合流する見た目を作れるようにするため）
const POINT_SNAP_DISTANCE_METERS = 6;
// 直前の点とほぼ同じ場所のクリックは点を増やさない（ダブルクリックの2回目のクリックなど）
const DUPLICATE_POINT_METERS = 0.5;

// 公開マップ（Leaflet 版 RoadOverlay.tsx・MapLibre 版 MapViewMapLibre.tsx）は、道ごとの幅
// （map_roads.width_meters）をまだ読まず、すべての道を同じ幅（既定 22m）で描く。
// この状態で幅の違う道（小路など）を描いて保存すると、来訪者のマップには追手筋と同じ幅で出てしまう。
// 道ごとの幅で描くようになるまで、「道を描く」ツールは使えないようにする
// （描く処理そのものは入れてあり、無効化を外すだけで使える。既存の道の編集・削除は対象外）
const isRoadCreationDisabled = true;

/** 道基準の位置を持ち、指定の道に乗っている区画（区画分けツールの対象） */
function slotsOnRoad(shops: EditableShop[], roadId: string): SlotOnRoad[] {
  return shops.flatMap((s) =>
    s.roadId === roadId && s.roadSide && s.roadDistanceM != null
      ? [{ locationId: s.locationId, side: s.roadSide, distanceM: s.roadDistanceM, hasVendor: !!s.vendorId }]
      : []
  );
}

export default function MapEditClientV3() {
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number }[]>([]);
  const [drawAxis, setDrawAxis] = useState<"h" | "v" | "free">("free");
  // 区画分けツールで選んだ道と、その設定
  const [splitRoadId, setSplitRoadId] = useState<string | null>(null);
  const [splitSettings, setSplitSettings] = useState<SlotSplitSettings | null>(null);

  const [search, setSearch] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
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
    vendors: data.vendors,
    setVendors: data.setVendors,
    routeConfig: data.routeConfig,
    mapSettingsLimits: data.mapSettingsLimits,
    setMessage,
  });

  // 画面に出す区画。道基準の位置を持つ区画は、今の道の形から緯度経度を計算し直す
  // （道の点を動かすと、保存する前から区画がついてくる）
  const displayShops = useMemo(() => resolveSlotPositions(shops, roads), [shops, roads]);

  const selectedShop = useMemo(
    () => (selection?.kind === "slot" ? displayShops.find((s) => s.locationId === selection.id) ?? null : null),
    [displayShops, selection]
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
    () => buildLaneRoadGroups(displayShops, roads, ops.roadIdOf),
    [displayShops, roads, ops.roadIdOf]
  );

  const unanchoredCount = useMemo(() => shops.filter((s) => !s.roadId).length, [shops]);

  // ── 区画分け ──────────────────────────────
  const splitRoad = useMemo(() => roads.find((r) => r.id === splitRoadId) ?? null, [roads, splitRoadId]);
  const splitRoadLengthM = useMemo(() => (splitRoad ? roadLengthMeters(splitRoad.points) : 0), [splitRoad]);
  const slotsOnSplitRoad: SlotOnRoad[] = useMemo(() => (splitRoad ? slotsOnRoad(shops, splitRoad.id) : []), [shops, splitRoad]);
  const splitPlan = useMemo(
    () => (splitRoad && splitSettings ? planRoadSlots(splitRoadLengthM, splitSettings, slotsOnSplitRoad) : null),
    [splitRoad, splitSettings, splitRoadLengthM, slotsOnSplitRoad]
  );
  const previewSlots = useMemo(() => {
    if (!splitRoad || !splitPlan || splitPlan.error) return [];
    const deleted = new Set(splitPlan.deletes.map((d) => d.locationId));
    const onRoad = shops.filter((s) => s.roadId === splitRoad.id && !deleted.has(s.locationId));
    const shopById = new Map(displayShops.map((s) => [s.locationId, s]));
    return [
      ...splitPlan.creates.map((c) => ({
        ...roadSlotLatLng(splitRoad.points, { distanceM: c.distanceM, side: c.side, offsetM: newSlotOffsetM(onRoad, c.side) }),
        status: "create" as const,
      })),
      ...splitPlan.moves.map((m) => ({
        ...roadSlotLatLng(splitRoad.points, {
          distanceM: m.toM,
          side: m.side,
          offsetM: shopById.get(m.locationId)?.roadOffsetM ?? 0,
        }),
        status: "move" as const,
      })),
      ...splitPlan.deletes.flatMap((d) => {
        const shop = shopById.get(d.locationId);
        return shop ? [{ lat: shop.lat, lng: shop.lng, status: "delete" as const }] : [];
      }),
    ];
  }, [splitRoad, splitPlan, shops, displayShops]);

  const startSplit = useCallback(
    (roadId: string) => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return;
      if (road.kind !== "market") {
        setMessage("区画分けは「出店可の通り」でだけ使えます。");
        return;
      }
      setTool("splitSlots");
      setSplitRoadId(road.id);
      setSplitSettings(initialSplitSettings(roadLengthMeters(road.points), slotsOnRoad(shops, road.id)));
      setSelection({ kind: "road", id: road.id });
    },
    [roads, shops, setMessage]
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
    setSplitRoadId(null);
    setSplitSettings(null);
  }, []);

  const changeTool = useCallback(
    (next: Tool) => {
      setDraft([]);
      setSplitRoadId(null);
      setSplitSettings(null);
      setTool(next);
      // 描いている道の頂点ハンドルと接続先の点が重なって紛らわしくならないよう、
      // 選択ツール以外に切り替えるときは道の選択を外す
      if (next !== "select") setSelection((prev) => (prev?.kind === "road" ? null : prev));
    },
    []
  );

  // ── 選択 ──────────────────────────────
  const selectShop = useCallback((locationId: string) => setSelection({ kind: "slot", id: locationId }), []);

  // 出店者のピン（地図）・セル（区画レーン）を別の区画へドラッグしたら、移動先を選び直す
  const dropVendor = useCallback(
    (fromLocationId: string, toLocationId: string) => {
      if (ops.moveVendor(fromLocationId, toLocationId)) setSelection({ kind: "slot", id: toLocationId });
    },
    [ops]
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
        startSplit(roadId);
        return;
      }
      setSelection({ kind: "road", id: roadId });
    },
    [tool, startSplit]
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

  /** 描いた道を確定する（ダブルクリック・Enter・「この形で確定」）。点が2つ未満なら知らせるだけ */
  const finishDraw = useCallback(() => {
    if (draft.length < 2) {
      setMessage("道は点を2つ以上打ってから確定してください。");
      return;
    }
    const id = ops.createRoad(draft);
    if (!id) return;
    backToSelect();
    setSelection({ kind: "road", id });
  }, [ops, draft, backToSelect, setMessage]);

  const handleDrawClick = useCallback(
    (lat: number, lng: number) => {
      // 既存の道の点の近くをクリックした場合は、座標をその点にぴったり合わせる
      // （軸ロックより優先し、明示的な接続の意図をそのまま反映する）
      const snapped = findNearestRoutePoint({ lat, lng });
      const nextLat = snapped ? snapped.lat : lat;
      const nextLng = snapped ? snapped.lng : lng;

      const last = draft[draft.length - 1];
      if (last && distanceMeters(last, { lat: nextLat, lng: nextLng }) < DUPLICATE_POINT_METERS) return;

      setDraft((prev) => {
        const first = prev[0];
        let pointLat = nextLat;
        let pointLng = nextLng;
        if (!snapped && first && drawAxis === "h") pointLat = first.lat;
        if (!snapped && first && drawAxis === "v") pointLng = first.lng;
        return [...prev, { lat: pointLat, lng: pointLng }];
      });
    },
    [findNearestRoutePoint, draft, drawAxis]
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

  // Esc: 道具の途中なら中断して選択ツールへ。選択ツールなら選択を外す。
  // Enter: 道を描く道具では描いた道を確定する
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && tool === "drawRoad") {
        const target = e.target;
        if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
        e.preventDefault();
        finishDraw();
        return;
      }
      if (e.key !== "Escape") return;
      if (tool !== "select") backToSelect();
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
  }, [tool, backToSelect, finishDraw]);

  useLaneKeyboardNavigation({
    enabled: tool === "select",
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
    onDropVendor: dropVendor,
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
      if (tool === "select") setSelection(null);
    },
    onMapDoubleClick: () => {
      if (tool === "drawRoad") finishDraw();
    },
    onVertexMove: ops.moveVertexLive,
    onVertexMoveEnd: ops.moveVertexEnd,
    onVertexRemove: ops.removeVertex,
    onMidpointInsert: ops.insertVertex,
  };

  const toolHintMessage =
    tool === "drawRoad"
        ? "クリックで点を追加、ダブルクリックかEnterで確定、Escで中断（既存の道の点の近くをクリックすると、その点に合わせます）"
        : tool === "splitSlots"
          ? splitRoad
            ? "右のパネルで区画数や範囲を決めて「適用」。Escで中断"
            : "区画を割り振る「出店可の通り」をクリック。Escで中断"
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
        onToggleHistory={() => {
          setIsImportOpen(false);
          data.setIsHistoryOpen((v) => !v);
        }}
        onToggleImport={() => {
          data.setIsHistoryOpen(false);
          setIsImportOpen((v) => !v);
        }}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={data.isSaving}
        pendingCount={history.past.length}
        onSave={() => void data.handleSave()}
        saveBlocked={!data.schemaReady}
      />

      {!data.schemaReady && (
        <div role="alert" style={{ padding: "8px 20px", background: "#FFF7E6", color: "#92400E", fontSize: 12.5, borderBottom: "1px solid #EDE3CD" }}>
          データベースの更新（マイグレーション）がまだ適用されていません。画面の確認はできますが、保存と区画の位置の移行はできません。
        </div>
      )}

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
              unsavedKeys={unsavedKeys}
              shops={displayShops}
              roads={roads}
              landmarks={landmarks}
              draft={draft}
              previewSlots={previewSlots}
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
                disabled={
                  isRoadCreationDisabled
                    ? { drawRoad: "公開マップが道ごとの幅で描くようになるまで、新しい道の追加は一時的に無効化しています" }
                    : {}
                }
              />
            </div>
            {toolHintMessage && (
              <div style={{ position: "absolute", top: 12, left: 180, right: 12, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                {/* maxWidth: 案内が長いときも左上の道具パレットに重ならず、枠の中で折り返すように */}
                <div style={{ pointerEvents: "auto", maxWidth: "100%", minWidth: 0 }}>
                  <ToolHint message={toolHintMessage} onCancel={backToSelect}>
                    {tool === "drawRoad" && draft.length >= 2 && (
                      <button type="button" onClick={finishDraw} style={{ padding: "4px 10px", borderRadius: 8, border: "none", fontWeight: 700, cursor: "pointer" }}>
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
              search={search}
              onDropVendor={dropVendor}
              onSelectShop={(locationId) => {
                const shop = displayShops.find((s) => s.locationId === locationId);
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
          {isImportOpen ? (
            <StoreImportPanel
              roads={roads}
              shops={shops}
              vendors={data.vendors}
              categories={data.categories}
              onClose={() => setIsImportOpen(false)}
              onApply={(plan) => {
                if (!plan.next) return;
                ops.applyStoreImport(
                  plan.next,
                  `出店者CSVを取り込み（区画 新規${plan.createdSlotCount}・更新${plan.updatedSlotCount}・削除${plan.deletedSlotCount}）`
                );
                setIsImportOpen(false);
                setSelection(null);
                setMessage("CSV を取り込みました。地図で内容を確かめてから「変更を保存」を押してください。");
              }}
            />
          ) : data.isHistoryOpen ? (
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
              {splitRoad && splitSettings && splitPlan && (
                <SlotSplitPanel
                  road={splitRoad}
                  roadLengthM={splitRoadLengthM}
                  settings={splitSettings}
                  onChange={setSplitSettings}
                  plan={splitPlan}
                  unanchoredCount={shops.filter((s) => !s.roadId && ops.roadIdOf(s) === splitRoad.id).length}
                  onApply={() => {
                    if (ops.applySlotPlan(splitRoad, splitPlan)) {
                      const roadId = splitRoad.id;
                      backToSelect();
                      setSelection({ kind: "road", id: roadId });
                    }
                  }}
                  onCancel={backToSelect}
                />
              )}
              {!selection && unanchoredCount > 0 && data.schemaReady && (
                <SlotMigrationPanel
                  unanchoredCount={unanchoredCount}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onMigrated={(count) => {
                    void data.reloadAfterWrite().then(() => setMessage(`${count} 件の区画を道の上の位置に移しました。`));
                  }}
                />
              )}
              {!splitRoad && (!selection || selection.kind === "road") && (
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
                <SlotVendorPanel
                  shop={selectedShop}
                  roadName={roads.find((r) => r.id === selectedShop.roadId)?.name ?? null}
                  vendor={data.vendors.find((v) => v.id === selectedShop.vendorId) ?? null}
                  vendors={data.vendors}
                  categories={data.categories}
                  onSelectVendor={(vendorId) => ops.assignVendor(selectedShop.locationId, vendorId)}
                  onRegisterVendor={(draft) => ops.registerVendor(selectedShop.locationId, draft)}
                  onUpdateVendor={(patch, logText, coalesceKey) =>
                    selectedShop.vendorId && ops.updateVendor(selectedShop.vendorId, patch, logText, { coalesceKey })
                  }
                  onClearVendor={() => ops.clearVendor(selectedShop.locationId)}
                  onDelete={() => {
                    if (ops.deleteSlot(selectedShop.locationId)) setSelection(null);
                  }}
                />
              )}
              {selectedRoad && !splitRoad && (
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
                  onStartSplit={() => startSplit(selectedRoad.id)}
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
