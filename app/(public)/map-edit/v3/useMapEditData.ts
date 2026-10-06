import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDefaultMapRouteConfig,
  getRouteCenter,
} from "../../map/utils/mapRouteGeometry";
import type { MapRouteConfig, MapRoutePoint } from "../../map/types/mapRoute";
import { createProjection } from "./geo";
import type { EntityChange } from "./editHistory";
import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  SnapshotItem,
  VendorOption,
} from "./types";
import { DEFAULT_MAX_LANDMARKS, DEFAULT_MAX_UNASSIGNED_SHOP_MARKERS } from "@/lib/map/mapSettingsDefaults";

export type MapSettingsLimits = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
};

const DEFAULT_MAP_SETTINGS_LIMITS: MapSettingsLimits = {
  maxLandmarks: DEFAULT_MAX_LANDMARKS,
  maxUnassignedShopMarkers: DEFAULT_MAX_UNASSIGNED_SHOP_MARKERS,
};

async function fetchMapLayout() {
  const response = await fetch("/api/admin/map-layout");
  if (!response.ok) throw new Error("failed");
  return response.json() as Promise<{
    shops?: EditableShop[];
    landmarks?: EditableLandmark[];
    route?: { points: MapRoutePoint[]; config: MapRouteConfig };
    roads?: EditableRoad[];
    vendors?: VendorOption[];
    mapSettingsLimits?: MapSettingsLimits;
  }>;
}

/**
 * 保存していない変化（editHistory の netChanges）から、PUT /api/admin/map-layout に送る
 * 区画・建物の差分を作る。道は従来どおり現在の一覧を丸ごと送る（サーバー側がフル置換で扱うため）。
 */
export function buildSavePayloadDiff(changes: EntityChange[]) {
  const shopChanges = changes.filter((change) => change.kind === "shops");
  const landmarkChanges = changes.filter((change) => change.kind === "landmarks");
  return {
    shops: {
      updated: shopChanges.flatMap((change) => (change.after ? [change.after as EditableShop] : [])),
      // 画面上で追加してまだ保存していない区画（new-）は DB に無いので、削除対象に含めない
      deletedLocationIds: shopChanges
        .filter((change) => change.before && !change.after && !change.id.startsWith("new-"))
        .map((change) => change.id),
    },
    landmarks: {
      upsert: landmarkChanges.flatMap((change) => (change.after ? [change.after as EditableLandmark] : [])),
      deletedKeys: landmarkChanges.filter((change) => change.before && !change.after).map((change) => change.id),
    },
  };
}

/**
 * マップ編集画面のデータの出入り（取得・保存・スナップショット）を持つ。
 *
 * 編集操作そのもの（区画の移動・道の作図・建物の配置など）は呼び出し側
 * （MapEditClientV3Body）が持つ。ここは「サーバーとやり取りする状態」だけに絞る。
 */
export function useMapEditData({
  changes,
  onLoaded,
  clearPending,
}: {
  /** 保存していない変化（呼び出し側が持つ操作の記録から作る）。保存時の差分と未保存の判定に使う */
  changes: EntityChange[];
  onLoaded?: () => void;
  /** 保存・復元が成功したら、呼び出し側が持つ操作の記録も空にする */
  clearPending?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [shops, setShops] = useState<EditableShop[]>([]);
  const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
  const [roads, setRoads] = useState<EditableRoad[]>([]);
  const [routeConfig, setRouteConfig] = useState<MapRouteConfig>(getDefaultMapRouteConfig());
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [mapSettingsLimits, setMapSettingsLimits] = useState<MapSettingsLimits>(DEFAULT_MAP_SETTINGS_LIMITS);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const originRef = useRef<{ lat: number; lng: number } | null>(null);

  /**
   * 保存・復元・移行のあとに、サーバーの内容で画面を読み直す。
   * 読み直した内容が新しい出発点になるので、操作の記録も空にする。
   */
  const reloadAfterWrite = useCallback(async () => {
    const nextData = await fetchMapLayout();
    setShops(Array.isArray(nextData.shops) ? nextData.shops : []);
    setLandmarks(Array.isArray(nextData.landmarks) ? nextData.landmarks : []);
    setRoads(Array.isArray(nextData.roads) ? nextData.roads : []);
    if (Array.isArray(nextData.vendors)) setVendorOptions(nextData.vendors);
    clearPending?.();
  }, [clearPending]);

  // ── データ取得 ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    void fetchMapLayout()
      .then((data) => {
        if (!active) return;
        const nextShops = Array.isArray(data.shops) ? data.shops : [];
        const nextLandmarks = Array.isArray(data.landmarks) ? data.landmarks : [];
        const nextRoads = Array.isArray(data.roads) ? data.roads : [];
        const nextConfig = { ...getDefaultMapRouteConfig(), ...(data.route?.config ?? {}) };
        const nextVendors = Array.isArray(data.vendors) ? data.vendors : [];

        setShops(nextShops);
        setLandmarks(nextLandmarks);
        setRoads(nextRoads);
        setRouteConfig(nextConfig);
        setVendorOptions(nextVendors);
        if (data.mapSettingsLimits) setMapSettingsLimits(data.mapSettingsLimits);

        const allPoints = nextRoads.flatMap((road) => road.points);
        const center = getRouteCenter(allPoints);
        originRef.current = { lat: center[0], lng: center[1] };
        onLoaded?.();
      })
      .catch(() => {
        if (active) setMessage("マップ編集データの取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
    // onLoaded は毎レンダー新しい関数になりうるが、初回データ取得の1回だけ
    // 呼べればよいので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projection = useMemo(() => {
    const origin = originRef.current ?? { lat: 0, lng: 0 };
    return createProjection(origin.lat, origin.lng);
  }, [roads.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 差分判定 ──────────────────────────────────────────
  const hasUnsavedChanges = changes.length > 0;

  // ── 保存 ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const diff = buildSavePayloadDiff(changes);
      const routePoints = roads.flatMap((road) => road.points);

      const response = await fetch("/api/admin/map-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shops: diff.shops,
          landmarks: diff.landmarks,
          route: { points: routePoints, config: routeConfig },
          roads: roads.map(({ points: _points, ...road }) => road),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "保存に失敗しました。");
        return;
      }

      await reloadAfterWrite();
      setMessage("保存しました。");
    } catch {
      setMessage("保存に失敗しました。通信環境を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }, [changes, roads, routeConfig, reloadAfterWrite]);

  // ── スナップショット ──────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const response = await fetch("/api/admin/map-layout/snapshots");
      if (!response.ok) return;
      const data = (await response.json()) as { snapshots?: SnapshotItem[] };
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    if (isHistoryOpen) void loadSnapshots();
  }, [isHistoryOpen, loadSnapshots]);

  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (hasUnsavedChanges) {
        setMessage("未保存の変更があるため復元できません。先に保存するか変更を取り消してください。");
        return;
      }
      setIsRestoring(snapshotId);
      try {
        const response = await fetch("/api/admin/map-layout/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
        });
        if (!response.ok) {
          setMessage("復元に失敗しました。");
          return;
        }
        await reloadAfterWrite();
        setMessage("スナップショットを復元しました。");
        await loadSnapshots();
      } finally {
        setIsRestoring(null);
      }
    },
    [hasUnsavedChanges, loadSnapshots, reloadAfterWrite]
  );

  return {
    isLoading,
    isSaving,
    message,
    setMessage,
    shops,
    setShops,
    landmarks,
    setLandmarks,
    roads,
    setRoads,
    routeConfig,
    vendorOptions,
    mapSettingsLimits,
    hasUnsavedChanges,
    handleSave,
    projection,
    snapshots,
    isLoadingSnapshots,
    isRestoring,
    isHistoryOpen,
    setIsHistoryOpen,
    handleRestoreSnapshot,
    reloadAfterWrite,
  };
}
