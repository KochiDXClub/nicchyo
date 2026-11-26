"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./mapEditor.css";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import { distanceMeters, getRouteCenter } from "../../map/utils/mapRouteGeometry";
import { resolveSlotPositions } from "@/lib/map/roadSlotPosition";
import type { MapRoutePoint, RoadKind } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, focusOfOperation, netChanges, type EditHistory, type EditOperation } from "./editHistory";
import { ROAD_KIND_DEFAULT_WIDTH, ROAD_KIND_LABELS, type CanvasHandlers, type EditableShop, type Selection, type Tool } from "./types";
import { useMapEditData } from "./useMapEditData";
import { useMapEditOperations } from "./useMapEditOperations";
import { useLaneKeyboardNavigation } from "./useLaneKeyboardNavigation";
import MapEditCanvasMapLibre from "./components/MapEditCanvasMapLibre";
import { MapEditHeader } from "./components/MapEditHeader";
import { SnapshotHistoryPanel } from "./components/SnapshotHistoryPanel";
import { RoadDetailPanel, RoadListPanel, LandmarkDetailPanel } from "./components/DetailPanels";
import SlotVendorPanel from "./components/SlotVendorPanel";
import { SUNDAY_MARKET_MARKER_COLOR, markerColorForRoad } from "@/lib/market/markerColor";
import { useChomeJudge } from "./useChomeJudge";
import PendingChangeLog from "./components/PendingChangeLog";
import { buildLaneRoadGroups, type LaneRoadGroup } from "./laneGroups";
import ToolPalette from "./components/ToolPalette";
import ToolHint from "./components/ToolHint";
import SlotMigrationPanel from "./components/SlotMigrationPanel";

const MAX_ZOOM_IDX = 2;
// 道を描いている途中、既存の点からこの距離（メートル）以内をクリックしたら
// その点に位置を合わせる（道同士が交差・合流する見た目を作れるようにするため）
const POINT_SNAP_DISTANCE_METERS = 6;
// 直前の点とほぼ同じ場所のクリックは点を増やさない（ダブルクリックの2回目のクリックなど）
const DUPLICATE_POINT_METERS = 0.5;

export default function MapEditClientV3() {
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<{ lat: number; lng: number }[]>([]);
  const [drawAxis, setDrawAxis] = useState<"h" | "v" | "free">("free");
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const { shops, roads, landmarks, projection, setMessage, hasUnsavedChanges, setIsHistoryOpen } = data;

  const { judge } = useChomeJudge(roads, data.chomeBoundaries, data.chomeSections);

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
    judgeChome: judge,
    setMessage,
  });

  // 画面に出す区画。道基準の位置を持つ区画は、今の道の形から緯度経度を計算し直す
  // （道の点を動かすと、保存する前から区画がついてくる）
  const displayShops = useMemo(() => resolveSlotPositions(shops, roads), [shops, roads]);
  // 区画の市は、乗っている道の市で決まる。日曜市以外の区画だけ、その市のマーカー色で地図に出す
  // （日曜市は市の色の設定にかかわらず従来の配色。色ではなく市の slug で判定する）
  const slotMarketColors = useMemo(() => {
    const roadMarket = new Map(roads.map((road) => [road.id, road.marketId]));
    const colors = new Map<string, string>();
    for (const shop of displayShops) {
      const marketId = shop.roadId ? roadMarket.get(shop.roadId) : null;
      const market = marketId ? data.markets.find((m) => m.id === marketId) : null;
      if (market && market.slug !== "nichiyo") colors.set(shop.locationId, markerColorForRoad(marketId, data.markets));
    }
    return colors;
  }, [displayShops, roads, data.markets]);

  const selectedShop = useMemo(
    () => (selection?.kind === "slot" ? displayShops.find((s) => s.locationId === selection.id) ?? null : null),
    [displayShops, selection]
  );
  // 選んだ区画の市（乗っている道の市。道が無ければ日曜市）。丁目の選択肢と見出しに使う
  const selectedShopMarket = useMemo(() => {
    if (!selectedShop) return null;
    const roadMarketId = roads.find((r) => r.id === selectedShop.roadId)?.marketId;
    return (roadMarketId ? data.markets.find((m) => m.id === roadMarketId) : null) ?? data.markets.find((m) => m.slug === "nichiyo") ?? null;
  }, [selectedShop, roads, data.markets]);
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

  // 区画の並び順（道→丁目→北側/南側）。キーボード/WASDナビゲーションがこの並び順を参照する
  // （並び順と移動の向きが食い違わないようにするため）
  const laneGroups: LaneRoadGroup[] = useMemo(
    () => buildLaneRoadGroups(displayShops, roads, ops.roadIdOf),
    [displayShops, roads, ops.roadIdOf]
  );

  const unanchoredCount = useMemo(() => shops.filter((s) => !s.roadId).length, [shops]);

  const focusOn = useCallback(
    (point: { lat: number; lng: number }) => setFocus(projection.toLocal(point.lat, point.lng)),
    [projection]
  );

  // ── 道具の切り替え ──────────────────────────────
  /** 道具の途中の状態（描きかけの道・移動先選び）を捨てて、選択ツールに戻る */
  const backToSelect = useCallback(() => {
    setTool("select");
    setDraft([]);
  }, []);

  const changeTool = useCallback(
    (next: Tool) => {
      setDraft([]);
      setTool(next);
      // 描いている道の頂点ハンドルと接続先の点が重なって紛らわしくならないよう、
      // 選択ツール以外に切り替えるときは道の選択を外す
      if (next !== "select") setSelection((prev) => (prev?.kind === "road" ? null : prev));
    },
    []
  );

  // ── 選択 ──────────────────────────────
  const selectShop = useCallback((locationId: string) => {
    setIsHistoryOpen(false);
    setSelection({ kind: "slot", id: locationId });
    setSheetOpen(true);
  }, [setIsHistoryOpen]);

  // 日付のない店舗移動は行わない。配置は開催日ごとの予定で管理する。
  const dropVendor = useCallback(() => {}, []);

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
      setSelection({ kind: "road", id: roadId });
        setIsHistoryOpen(false);
      setSheetOpen(true);
    },
    [setIsHistoryOpen]
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
    onSelectLandmark: (key) => { data.setIsHistoryOpen(false); setSelection({ kind: "landmark", id: key }); setSheetOpen(true); },
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
        if (key) { setSelection({ kind: "landmark", id: key }); setSheetOpen(true); }
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
        : tool === "placeLandmark"
            ? "建物を置く場所をクリック。Escで中断"
            : null;

  return (
    <div className="map-editor">
      <MapEditHeader
        search={search}
        onSearchChange={setSearch}
        occupiedCount={shopCounts.occupied}
        vacantCount={shopCounts.vacant}
        roadCount={roads.length}
        landmarkCount={landmarks.length}
        limits={data.mapSettingsLimits}
        onToggleHistory={() => {
          setSheetOpen(true);
          data.setIsHistoryOpen((v) => sheetOpen ? !v : true);
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

      {data.fieldObservationsUnavailable && (
        <div role="alert" className="bg-amber-50 px-5 py-2 text-sm text-amber-800">現場で記録した位置を読み込めませんでした。地図の編集はできますが、現場の位置を反映するには再読み込みしてください。</div>
      )}

      {data.message && (
        <div style={{ padding: "8px 20px", background: "#FFF7E6", color: "#92400E", fontSize: 12.5, borderBottom: "1px solid #EDE3CD" }}>
          {data.message}
        </div>
      )}

      <div className="map-editor-workspace">
        <div className="map-editor-map-column">
          <div className="map-editor-map">
            <MapEditCanvasMapLibre
              tool={tool}
              selection={selection}
              unsavedKeys={unsavedKeys}
              shops={displayShops}
              slotMarketColors={slotMarketColors}
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
            <div className="map-editor-tools">
              <ToolPalette tool={tool} onChange={changeTool} />
            </div>
            {toolHintMessage && (
              <div className="map-editor-hint">
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
            <button type="button" className="map-editor-sheet-toggle" aria-expanded={sheetOpen} aria-controls="map-editor-aside" onClick={() => setSheetOpen(true)}>詳細・操作を開く</button>
          </div>
        </div>

        <aside id="map-editor-aside" className={`map-editor-aside ${sheetOpen ? "" : "is-closed"}`} aria-label="地図の詳細と操作">
          <div className="map-editor-aside-header"><div><p>MAP EDITOR</p><h2>{data.isHistoryOpen ? "保存履歴" : selectedShop ? "区画の詳細" : selectedRoad ? "道の詳細" : selectedLandmark ? "建物の詳細" : "地図の詳細と操作"}</h2></div><button type="button" className="map-editor-sheet-close" onClick={() => { setSheetOpen(false); data.setIsHistoryOpen(false); }}>地図に戻る</button></div>
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
              {!selection && unanchoredCount > 0 && data.schemaReady && (
                <SlotMigrationPanel
                  unanchoredCount={unanchoredCount}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onMigrated={(count) => {
                    void data.reloadAfterWrite().then(() => setMessage(`${count} 件の区画を道の上の位置に移しました。`));
                  }}
                />
              )}
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
                <SlotVendorPanel
                  shop={selectedShop}
                  roadName={roads.find((r) => r.id === selectedShop.roadId)?.name ?? null}
                  market={(() => {
                    const roadMarketId = roads.find((r) => r.id === selectedShop.roadId)?.marketId;
                    const market = (roadMarketId ? data.markets.find((m) => m.id === roadMarketId) : data.markets.find((m) => m.slug === "nichiyo")) ?? null;
                    return market ? { name: market.name, color: slotMarketColors.get(selectedShop.locationId) ?? SUNDAY_MARKET_MARKER_COLOR } : null;
                  })()}
                  vendor={data.vendors.find((v) => v.id === selectedShop.vendorId) ?? null}
                  onApplyFieldObservation={() => ops.applyFieldObservation(selectedShop.locationId)}
                  onAddressChange={(address) => { ops.setSlotAddress(selectedShop.locationId, address); }}
                  onChomeChange={(value) => ops.setSlotChome(selectedShop.locationId, value)}
                  chomeLabels={data.marketAreas.filter((area) => area.marketId === selectedShopMarket?.id).map((area) => area.label)}
                  marketName={selectedShopMarket?.name}
                  autoChome={
                    selectedShop.roadId && selectedShop.roadDistanceM != null
                      ? judge(selectedShop.roadId, selectedShop.roadDistanceM)
                      : null
                  }
                  onDelete={() => {
                    if (ops.deleteSlot(selectedShop.locationId)) setSelection(null);
                  }}
                />
              )}
              {selectedRoad && (
                <RoadDetailPanel
                  road={selectedRoad}
                  markets={data.markets}
                  onAddPlace={() => ops.addSlot(selectedRoad)}
                  onMarketChange={(marketId) => ops.patchRoad(selectedRoad.id, { marketId }, "の所属する市を変更")}
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
