import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getDefaultMapRouteConfig,
  getRouteCenter,
} from "../../map/utils/mapRouteGeometry";
import type { MapRouteConfig, MapRoutePoint } from "../../map/types/mapRoute";
import { createProjection } from "./geo";
import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  SnapshotItem,
  VendorOption,
} from "./types";

export type MapSettingsLimits = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
};

const DEFAULT_MAP_SETTINGS_LIMITS: MapSettingsLimits = {
  maxLandmarks: 80,
  maxUnassignedShopMarkers: 40,
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

function cloneShops(shops: EditableShop[]) {
  return shops.map((shop) => ({ ...shop }));
}
function cloneLandmarks(landmarks: EditableLandmark[]) {
  return landmarks.map((landmark) => ({ ...landmark }));
}
function cloneRoads(roads: EditableRoad[]) {
  return roads.map((road) => ({ ...road, points: road.points.map((p) => ({ ...p })) }));
}

/**
 * マップ編集画面のデータの出入り（取得・保存・スナップショット）を持つ。
 *
 * 編集操作そのもの（区画の移動・道の作図・建物の配置など）は呼び出し側
 * （MapEditClientV3Body）が持つ。ここは「サーバーとやり取りする状態」だけに絞る。
 */
export function useMapEditData({
  onLoaded,
  clearPending,
}: {
  onLoaded?: () => void;
  /** 保存・復元が成功したら、呼び出し側が持つ「変更ログ」（pending）も空にする */
  clearPending?: () => void;
} = {}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [shops, setShops] = useState<EditableShop[]>([]);
  const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
  const [roads, setRoads] = useState<EditableRoad[]>([]);
  const [routeConfig, setRouteConfig] = useState<MapRouteConfig>(getDefaultMapRouteConfig());
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [mapSettingsLimits, setMapSettingsLimits] = useState<MapSettingsLimits>(DEFAULT_MAP_SETTINGS_LIMITS);

  const [initialShops, setInitialShops] = useState<EditableShop[]>([]);
  const [initialLandmarks, setInitialLandmarks] = useState<EditableLandmark[]>([]);
  const [initialRoads, setInitialRoads] = useState<EditableRoad[]>([]);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const originRef = useRef<{ lat: number; lng: number } | null>(null);

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
        setInitialShops(cloneShops(nextShops));
        setInitialLandmarks(cloneLandmarks(nextLandmarks));
        setInitialRoads(cloneRoads(nextRoads));

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
  const hasUnsavedChanges = useMemo(() => {
    const initialShopMap = new Map(initialShops.map((s) => [s.locationId, s]));
    const currentShopMap = new Map(shops.map((s) => [s.locationId, s]));
    const shopChanged = shops.some((shop) => {
      const initial = initialShopMap.get(shop.locationId);
      if (!initial) return true;
      return (
        initial.lat !== shop.lat ||
        initial.lng !== shop.lng ||
        initial.position !== shop.position ||
        initial.vendorId !== shop.vendorId
      );
    });
    const shopDeleted = initialShops.some((s) => !currentShopMap.has(s.locationId));

    const initialLandmarkMap = new Map(initialLandmarks.map((l) => [l.key, l]));
    const currentLandmarkMap = new Map(landmarks.map((l) => [l.key, l]));
    const landmarkChanged = landmarks.some((landmark) => {
      const initial = initialLandmarkMap.get(landmark.key);
      if (!initial) return true;
      return (
        initial.name !== landmark.name ||
        initial.description !== landmark.description ||
        initial.url !== landmark.url ||
        initial.lat !== landmark.lat ||
        initial.lng !== landmark.lng ||
        initial.widthPx !== landmark.widthPx ||
        initial.heightPx !== landmark.heightPx ||
        initial.showAtMinZoom !== landmark.showAtMinZoom
      );
    });
    const landmarkDeleted = initialLandmarks.some((l) => !currentLandmarkMap.has(l.key));

    const roadsChanged = JSON.stringify(roads) !== JSON.stringify(initialRoads);

    return shopChanged || shopDeleted || landmarkChanged || landmarkDeleted || roadsChanged;
  }, [shops, initialShops, landmarks, initialLandmarks, roads, initialRoads]);

  // ── 保存 ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const initialShopMap = new Map(initialShops.map((s) => [s.locationId, s]));
      const updatedShops = shops.filter((shop) => {
        const initial = initialShopMap.get(shop.locationId);
        if (!initial) return true;
        return (
          initial.lat !== shop.lat ||
          initial.lng !== shop.lng ||
          initial.position !== shop.position ||
          initial.vendorId !== shop.vendorId
        );
      });
      const currentShopIds = new Set(shops.map((s) => s.locationId));
      const deletedLocationIds = initialShops
        .filter((s) => !currentShopIds.has(s.locationId))
        .map((s) => s.locationId);

      const initialLandmarkMap = new Map(initialLandmarks.map((l) => [l.key, l]));
      const upsertLandmarks = landmarks.filter((landmark) => {
        const initial = initialLandmarkMap.get(landmark.key);
        if (!initial) return true;
        return JSON.stringify(initial) !== JSON.stringify(landmark);
      });
      const currentLandmarkKeys = new Set(landmarks.map((l) => l.key));
      const deletedKeys = initialLandmarks
        .filter((l) => !currentLandmarkKeys.has(l.key))
        .map((l) => l.key);

      const routePoints = roads.flatMap((road) => road.points);

      const response = await fetch("/api/admin/map-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shops: { updated: updatedShops, deletedLocationIds },
          landmarks: { upsert: upsertLandmarks, deletedKeys },
          route: { points: routePoints, config: routeConfig },
          roads: roads.map(({ points: _points, ...road }) => road),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "保存に失敗しました。");
        return;
      }

      const nextData = await fetchMapLayout();
      const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
      const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
      const nextRoads = Array.isArray(nextData.roads) ? nextData.roads : [];
      setShops(nextShops);
      setLandmarks(nextLandmarks);
      setRoads(nextRoads);
      setInitialShops(cloneShops(nextShops));
      setInitialLandmarks(cloneLandmarks(nextLandmarks));
      setInitialRoads(cloneRoads(nextRoads));
      clearPending?.();
      setMessage("保存しました。");
    } catch {
      setMessage("保存に失敗しました。通信環境を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }, [shops, initialShops, landmarks, initialLandmarks, roads, routeConfig, clearPending]);

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
        const nextData = await fetchMapLayout();
        const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
        const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
        const nextRoads = Array.isArray(nextData.roads) ? nextData.roads : [];
        setShops(nextShops);
        setLandmarks(nextLandmarks);
        setRoads(nextRoads);
        setInitialShops(cloneShops(nextShops));
        setInitialLandmarks(cloneLandmarks(nextLandmarks));
        setInitialRoads(cloneRoads(nextRoads));
        clearPending?.();
        setMessage("スナップショットを復元しました。");
        await loadSnapshots();
      } finally {
        setIsRestoring(null);
      }
    },
    [hasUnsavedChanges, loadSnapshots, clearPending]
  );

  return {
    isLoading,
    isSaving,
    message,
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
  };
}
