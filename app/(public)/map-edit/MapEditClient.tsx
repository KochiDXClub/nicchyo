"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Trash2 } from "lucide-react";
import type { Landmark as EditableLandmark } from "../map/types/landmark";
import type { MapRoute, MapRouteConfig, MapRoutePoint } from "../map/types/mapRoute";
import {
  getBranchParent,
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getMainRouteNeighbors,
  getRoutePointStatus,
  getRoutePointRole,
  getRouteLengthKm,
  normalizeMapRoutePoints,
  stabilizeRoutePointMove,
} from "../map/utils/mapRouteGeometry";

type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
};

type VendorOption = {
  id: string;
  name: string;
};

type SnapshotItem = {
  id: string;
  created_at: string;
  created_by: string | null;
  summary?: {
    updatedShopCount?: number;
    deletedShopCount?: number;
    upsertLandmarkCount?: number;
    deletedLandmarkCount?: number;
    restoreSourceSnapshotId?: string;
  } | null;
};

type MapSettings = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
  maxMapSnapshots: number;
  maxEditZoom: number;
};

const DEFAULT_MAP_SETTINGS: MapSettings = {
  maxLandmarks: 80,
  maxUnassignedShopMarkers: 40,
  maxMapSnapshots: 50,
  maxEditZoom: 20,
};

const MapLayoutEditor = dynamic(() => import("./MapLayoutEditor"), { ssr: false });

function cloneShops(shops: EditableShop[]) {
  return shops.map((shop) => ({ ...shop }));
}

function cloneLandmarks(landmarks: EditableLandmark[]) {
  return landmarks.map((landmark) => ({ ...landmark }));
}

function cloneRoutePoints(points: MapRoutePoint[]) {
  return points.map((point) => ({ ...point }));
}

function cloneRouteConfig(config: MapRouteConfig) {
  return { ...config };
}

function areRoutePointsEqual(a: MapRoutePoint[], b: MapRoutePoint[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((point, index) => {
    const target = b[index];
    if (!target) {
      return false;
    }
    return (
      point.id === target.id &&
      point.lat === target.lat &&
      point.lng === target.lng &&
      point.order === target.order &&
      (point.branchFromId ?? null) === (target.branchFromId ?? null)
    );
  });
}

function getUnassignedPriority(shop: EditableShop) {
  if (shop.vendorId) return Number.NEGATIVE_INFINITY;
  if (shop.locationId.startsWith("new-")) {
    const createdAt = Number(shop.locationId.slice(4));
    if (Number.isFinite(createdAt)) {
      return createdAt;
    }
  }
  return 0;
}

function sortShops(items: EditableShop[]) {
  return [...items].sort((a, b) => {
    const aUnassigned = a.vendorId ? 1 : 0;
    const bUnassigned = b.vendorId ? 1 : 0;
    if (aUnassigned !== bUnassigned) {
      return aUnassigned - bUnassigned;
    }
    if (!a.vendorId && !b.vendorId) {
      const priorityDiff = getUnassignedPriority(b) - getUnassignedPriority(a);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
    }
    return a.position - b.position;
  });
}

async function fetchMapLayout() {
  const response = await fetch("/api/admin/map-layout");
  if (!response.ok) {
    throw new Error("failed");
  }
  return response.json() as Promise<{
    shops?: EditableShop[];
    landmarks?: EditableLandmark[];
    route?: MapRoute;
    vendors?: VendorOption[];
  }>;
}

export default function MapEditClient() {
  const [shops, setShops] = useState<EditableShop[]>([]);
  const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
  const [routePoints, setRoutePoints] = useState<MapRoutePoint[]>([]);
  const [routeConfig, setRouteConfig] = useState<MapRouteConfig>(getDefaultMapRouteConfig());
  const [initialShops, setInitialShops] = useState<EditableShop[]>([]);
  const [initialLandmarks, setInitialLandmarks] = useState<EditableLandmark[]>([]);
  const [initialRoutePoints, setInitialRoutePoints] = useState<MapRoutePoint[]>([]);
  const [initialRouteConfig, setInitialRouteConfig] = useState<MapRouteConfig>(getDefaultMapRouteConfig());
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [selectedKind, setSelectedKind] = useState<"shop" | "landmark" | "route">("shop");
  const [selectedId, setSelectedId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shopQuery, setShopQuery] = useState("");
  const [landmarkQuery, setLandmarkQuery] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [mapSettings, setMapSettings] = useState<MapSettings>(DEFAULT_MAP_SETTINGS);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const shopItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const landmarkItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const routePointItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchMapLayout(),
      fetch("/api/admin/settings")
        .then(async (response) => {
          if (!response.ok) throw new Error("failed");
          return (await response.json()) as { map?: Partial<MapSettings> };
        })
        .catch(() => ({ map: DEFAULT_MAP_SETTINGS })),
    ])
      .then(([data, settingsData]) => {
        if (!active) return;
        const nextShops = Array.isArray(data.shops) ? (data.shops as EditableShop[]) : [];
        const nextLandmarks = Array.isArray(data.landmarks)
          ? (data.landmarks as EditableLandmark[])
          : [];
        const nextRoutePoints = normalizeMapRoutePoints(data.route?.points ?? getDefaultMapRoutePoints());
        const nextRouteConfig = {
          ...getDefaultMapRouteConfig(),
          ...(data.route?.config ?? {}),
        };
        const nextVendors = Array.isArray(data.vendors) ? (data.vendors as VendorOption[]) : [];
        const nextMapSettings = { ...DEFAULT_MAP_SETTINGS, ...(settingsData.map ?? {}) };
        setShops(sortShops(nextShops));
        setLandmarks(nextLandmarks);
        setRoutePoints(nextRoutePoints);
        setRouteConfig(nextRouteConfig);
        setVendorOptions(nextVendors);
        setMapSettings(nextMapSettings);
        setInitialShops(cloneShops(nextShops));
        setInitialLandmarks(cloneLandmarks(nextLandmarks));
        setInitialRoutePoints(cloneRoutePoints(nextRoutePoints));
        setInitialRouteConfig(cloneRouteConfig(nextRouteConfig));
        setLastSavedAt(new Date().toISOString());
      })
      .catch(() => {
        if (!active) return;
        setMessage("マップ編集データの取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedShop = useMemo(
    () => shops.find((shop) => String(shop.id) === selectedId) ?? null,
    [selectedId, shops]
  );
  const selectedLandmark = useMemo(
    () => landmarks.find((landmark) => landmark.key === selectedId) ?? null,
    [landmarks, selectedId]
  );
  const selectedRoutePoint = useMemo(
    () => routePoints.find((point) => point.id === selectedId) ?? null,
    [routePoints, selectedId]
  );
  const normalizedShopQuery = shopQuery.trim().toLowerCase();
  const normalizedLandmarkQuery = landmarkQuery.trim().toLowerCase();
  const normalizedRouteQuery = routeQuery.trim().toLowerCase();
  const filteredShops = useMemo(
    () =>
      sortShops(
        shops.filter((shop) => {
          if (selectedKind === "shop" && selectedId === String(shop.id)) return true;
          if (!normalizedShopQuery) return true;
          return (
            shop.name.toLowerCase().includes(normalizedShopQuery) ||
            String(shop.id).includes(normalizedShopQuery)
          );
        })
      ),
    [normalizedShopQuery, selectedId, selectedKind, shops]
  );
  const filteredLandmarks = useMemo(
    () =>
      landmarks.filter((landmark) => {
        if (selectedKind === "landmark" && selectedId === landmark.key) return true;
        if (!normalizedLandmarkQuery) return true;
        return landmark.name.toLowerCase().includes(normalizedLandmarkQuery);
      }),
    [landmarks, normalizedLandmarkQuery, selectedId, selectedKind]
  );
  const filteredRoutePoints = useMemo(
    () =>
      routePoints.filter((point, index) => {
        if (selectedKind === "route" && selectedId === point.id) return true;
        if (!normalizedRouteQuery) return true;
        const status = getRoutePointStatus(routePoints, point.id);
        return (
          point.id.toLowerCase().includes(normalizedRouteQuery) ||
          String(index + 1).includes(normalizedRouteQuery) ||
          `ポイント ${index + 1}`.toLowerCase().includes(normalizedRouteQuery) ||
          (status?.label ?? "").toLowerCase().includes(normalizedRouteQuery)
        );
      }),
    [normalizedRouteQuery, routePoints, selectedId, selectedKind]
  );
  const routeLengthKm = useMemo(() => getRouteLengthKm(routePoints), [routePoints]);
  const hasUnsavedChanges = useMemo(() => {
    const initialShopMap = new Map(initialShops.map((shop) => [shop.locationId, shop]));
    const currentShopMap = new Map(shops.map((shop) => [shop.locationId, shop]));
    const updatedShopExists = shops.some((shop) => {
      const initial = initialShopMap.get(shop.locationId);
      if (!initial) return true;
      return (
        initial.lat !== shop.lat ||
        initial.lng !== shop.lng ||
        initial.position !== shop.position ||
        initial.vendorId !== shop.vendorId
      );
    });
    const deletedShopExists = initialShops.some((shop) => !currentShopMap.has(shop.locationId));
    const initialLandmarkMap = new Map(initialLandmarks.map((landmark) => [landmark.key, landmark]));
    const currentLandmarkMap = new Map(landmarks.map((landmark) => [landmark.key, landmark]));
    const updatedLandmarkExists = landmarks.some((landmark) => {
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
    const deletedLandmarkExists = initialLandmarks.some(
      (landmark) => !currentLandmarkMap.has(landmark.key)
    );
    const routePointsChanged = !areRoutePointsEqual(initialRoutePoints, routePoints);
    const routeConfigChanged =
      initialRouteConfig.roadHalfWidthMeters !== routeConfig.roadHalfWidthMeters ||
      initialRouteConfig.snapDistanceMeters !== routeConfig.snapDistanceMeters ||
      initialRouteConfig.visibleDistanceMeters !== routeConfig.visibleDistanceMeters;

    return (
      updatedShopExists ||
      deletedShopExists ||
      updatedLandmarkExists ||
      deletedLandmarkExists ||
      routePointsChanged ||
      routeConfigChanged
    );
  }, [
    initialLandmarks,
    initialRouteConfig,
    initialRoutePoints,
    initialShops,
    landmarks,
    routeConfig,
    routePoints,
    shops,
  ]);

  const loadSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const response = await fetch("/api/admin/map-layout/snapshots");
      if (!response.ok) throw new Error("failed");
      const data = (await response.json()) as { snapshots?: SnapshotItem[] };
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
    } catch {
      setMessage("バックアップ履歴の取得に失敗しました。");
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (!selectedId) return;

    const target =
      selectedKind === "shop"
        ? shopItemRefs.current[selectedId]
        : selectedKind === "landmark"
          ? landmarkItemRefs.current[selectedId]
          : routePointItemRefs.current[selectedId];

    target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [filteredLandmarks, filteredRoutePoints, filteredShops, selectedId, selectedKind]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const initialShopMap = new Map(initialShops.map((shop) => [shop.locationId, shop]));
      const currentShopMap = new Map(shops.map((shop) => [shop.locationId, shop]));
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
      const deletedLocationIds = initialShops
        .filter((shop) => !currentShopMap.has(shop.locationId))
        .map((shop) => shop.locationId);

      const initialLandmarkMap = new Map(initialLandmarks.map((landmark) => [landmark.key, landmark]));
      const currentLandmarkMap = new Map(landmarks.map((landmark) => [landmark.key, landmark]));
      const upsertLandmarks = landmarks.filter((landmark) => {
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
      const deletedLandmarkKeys = initialLandmarks
        .filter((landmark) => !currentLandmarkMap.has(landmark.key))
        .map((landmark) => landmark.key);
      const routePointsChanged = !areRoutePointsEqual(initialRoutePoints, routePoints);
      const routeConfigChanged =
        initialRouteConfig.roadHalfWidthMeters !== routeConfig.roadHalfWidthMeters ||
        initialRouteConfig.snapDistanceMeters !== routeConfig.snapDistanceMeters ||
        initialRouteConfig.visibleDistanceMeters !== routeConfig.visibleDistanceMeters;

      if (
        updatedShops.length === 0 &&
        deletedLocationIds.length === 0 &&
        upsertLandmarks.length === 0 &&
        deletedLandmarkKeys.length === 0 &&
        !routePointsChanged &&
        !routeConfigChanged
      ) {
        setMessage("変更はありません。");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/admin/map-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shops: {
            updated: updatedShops,
            deletedLocationIds,
          },
          landmarks: {
            upsert: upsertLandmarks,
            deletedKeys: deletedLandmarkKeys,
          },
          route: {
            points: routePoints,
            config: routeConfig,
          },
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const nextData = await fetchMapLayout();
      const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
      const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
      const nextRoutePoints = normalizeMapRoutePoints(nextData.route?.points ?? getDefaultMapRoutePoints());
      const nextRouteConfig = {
        ...getDefaultMapRouteConfig(),
        ...(nextData.route?.config ?? {}),
      };
      const nextVendors = Array.isArray(nextData.vendors) ? nextData.vendors : [];
      setShops(sortShops(nextShops));
      setLandmarks(nextLandmarks);
      setRoutePoints(nextRoutePoints);
      setRouteConfig(nextRouteConfig);
      setVendorOptions(nextVendors);
      setInitialShops(cloneShops(nextShops));
      setInitialLandmarks(cloneLandmarks(nextLandmarks));
      setInitialRoutePoints(cloneRoutePoints(nextRoutePoints));
      setInitialRouteConfig(cloneRouteConfig(nextRouteConfig));
      setLastSavedAt(new Date().toISOString());
      if (isHistoryOpen) {
        await loadSnapshots();
      }
      setMessage("保存しました。店舗・建物・道路通路の編集をDBへ反映しました。");
    } catch {
      setMessage("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShop = (shopId: number) => {
    setShops((prev) => {
      const next = prev.filter((shop) => shop.id !== shopId);
      if (selectedKind === "shop" && selectedId === String(shopId)) {
        setSelectedId(next[0] ? String(next[0].id) : "");
      }
      return next;
    });
  };

  const handleDeleteLandmark = (key: string) => {
    setLandmarks((prev) => {
      const next = prev.filter((item) => item.key !== key);
      if (selectedKind === "landmark" && selectedId === key) {
        setSelectedId(next[0]?.key ?? "");
      }
      return next;
    });
  };

  const handleConfirmLandmark = (key: string) => {
    setSelectedKind("landmark");
    setSelectedId("");
    setMessage(`建物オブジェクト ${key} の編集を確定しました。保存するとDBへ反映されます。`);
  };

  const handleCancelLandmark = (key: string) => {
    setLandmarks((prev) => {
      if (key.startsWith("landmark-")) {
        return prev.filter((item) => item.key !== key);
      }
      const initial = initialLandmarks.find((item) => item.key === key);
      if (!initial) return prev;
      return prev.map((item) => (item.key === key ? { ...initial } : item));
    });
    if (selectedKind === "landmark" && selectedId === key) {
      setSelectedId("");
    }
  };

  const handleAddShop = () => {
    const unassignedCount = shops.filter((shop) => !shop.vendorId).length;
    if (unassignedCount >= mapSettings.maxUnassignedShopMarkers) {
      setMessage(`未割当マーカは最大 ${mapSettings.maxUnassignedShopMarkers} 件までです。`);
      return;
    }
    const nextPosition = shops.reduce((max, shop) => Math.max(max, shop.position), 0) + 1;
    const fallback = selectedShop ?? shops[shops.length - 1] ?? null;
    const nextShop: EditableShop = {
      locationId: `new-${Date.now()}`,
      id: nextPosition,
      name: `未設定店舗 ${nextPosition}`,
      lat: fallback?.lat ?? 33.56145,
      lng: fallback?.lng ?? 133.5383,
      position: nextPosition,
    };
    setShops((prev) => sortShops([...prev, nextShop]));
    setSelectedKind("shop");
    setSelectedId(String(nextShop.id));
  };

  const handleConfirmNewShop = (shopId: number) => {
    setSelectedKind("shop");
    setSelectedId("");
    setMessage(`店舗マーカ #${shopId} を追加しました。保存するとDBへ反映されます。`);
  };

  const handleAddLandmark = () => {
    if (landmarks.length >= mapSettings.maxLandmarks) {
      setMessage(`建物オブジェクトは最大 ${mapSettings.maxLandmarks} 件までです。`);
      return;
    }
    const nextKey = `landmark-${Date.now()}`;
    const fallback = selectedLandmark ?? landmarks[landmarks.length - 1] ?? null;
    const nextLandmark: EditableLandmark = {
      key: nextKey,
      name: "",
      description: "",
      url: "",
      lat: fallback?.lat ?? 33.56145,
      lng: fallback?.lng ?? 133.5383,
      widthPx: 120,
      heightPx: 120,
      showAtMinZoom: false,
    };
    setLandmarks((prev) => [...prev, nextLandmark]);
    setSelectedKind("landmark");
    setSelectedId(nextKey);
  };

  const handleConfirmShop = (shopId: number) => {
    setSelectedKind("shop");
    setSelectedId("");
    setMessage(`店舗マーカ #${shopId} の編集を確定しました。保存するとDBへ反映されます。`);
  };

  const handleCancelShop = (shopId: number) => {
    setShops((prev) => {
      const target = prev.find((shop) => shop.id === shopId);
      if (!target) return prev;
      if (target.locationId.startsWith("new-")) {
        return prev.filter((shop) => shop.id !== shopId);
      }
      const initial = initialShops.find((shop) => shop.locationId === target.locationId);
      if (!initial) return prev;
      return sortShops(prev.map((shop) => (shop.id === shopId ? { ...initial } : shop)));
    });
    if (selectedKind === "shop" && selectedId === String(shopId)) {
      setSelectedId("");
    }
  };

  const toggleShopSelection = (shopId: number) => {
    if (selectedKind === "shop" && selectedId === String(shopId)) {
      setSelectedId("");
      return;
    }
    setSelectedKind("shop");
    setSelectedId(String(shopId));
  };

  const toggleLandmarkSelection = (landmarkKey: string) => {
    if (selectedKind === "landmark" && selectedId === landmarkKey) {
      setSelectedId("");
      return;
    }
    setSelectedKind("landmark");
    setSelectedId(landmarkKey);
  };

  const handleOpenHistory = async () => {
    if (!isHistoryOpen) {
      setIsHistoryOpen(true);
      await loadSnapshots();
      return;
    }
    setIsHistoryOpen(false);
  };

  const handleResetToLastSaved = () => {
    setShops(sortShops(cloneShops(initialShops)));
    setLandmarks(cloneLandmarks(initialLandmarks));
    setRoutePoints(cloneRoutePoints(initialRoutePoints));
    setRouteConfig(cloneRouteConfig(initialRouteConfig));
    setSelectedId("");
    setMessage("保存済みの状態に戻しました。");
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (hasUnsavedChanges) {
      setMessage("現在の変更を保存してからでないと復元できません。");
      return;
    }

    setIsRestoring(snapshotId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/map-layout/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      if (!response.ok) throw new Error("restore failed");

      const nextData = await fetchMapLayout();
      const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
      const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
      const nextRoutePoints = normalizeMapRoutePoints(nextData.route?.points ?? getDefaultMapRoutePoints());
      const nextRouteConfig = {
        ...getDefaultMapRouteConfig(),
        ...(nextData.route?.config ?? {}),
      };
      const nextVendors = Array.isArray(nextData.vendors) ? nextData.vendors : [];
      setShops(sortShops(nextShops));
      setLandmarks(nextLandmarks);
      setRoutePoints(nextRoutePoints);
      setRouteConfig(nextRouteConfig);
      setVendorOptions(nextVendors);
      setInitialShops(cloneShops(nextShops));
      setInitialLandmarks(cloneLandmarks(nextLandmarks));
      setInitialRoutePoints(cloneRoutePoints(nextRoutePoints));
      setInitialRouteConfig(cloneRouteConfig(nextRouteConfig));
      setLastSavedAt(new Date().toISOString());
      await loadSnapshots();
      setMessage("バックアップから復元しました。復元前の状態も自動保存しています。");
    } catch {
      setMessage("バックアップからの復元に失敗しました。");
    } finally {
      setIsRestoring(null);
    }
  };

  const handleAddRoutePoint = () => {
    const base =
      selectedRoutePoint ??
      routePoints[routePoints.length - 1] ?? {
        id: "route-point-seed",
        lat: 33.56145,
        lng: 133.5383,
        order: 0,
      };
    const nextPoint: MapRoutePoint = {
      id: `route-point-${Date.now()}`,
      lat: base.lat,
      lng: base.lng,
      order: routePoints.length,
      branchFromId: null,
    };
    const next = normalizeMapRoutePoints([...routePoints, nextPoint]);
    setRoutePoints(next);
    setSelectedKind("route");
    setSelectedId(nextPoint.id);
  };

  const handleDeleteRoutePoint = (pointId: string) => {
    setRoutePoints((prev) => normalizeMapRoutePoints(prev.filter((point) => point.id !== pointId)));
    if (selectedKind === "route" && selectedId === pointId) {
      setSelectedId("");
    }
  };

  const toggleRouteSelection = (pointId: string) => {
    if (selectedKind === "route" && selectedId === pointId) {
      setSelectedId("");
      return;
    }
    setSelectedKind("route");
    setSelectedId(pointId);
  };

  const handleInsertRoutePointAtSegment = (
    segmentStartId: string,
    lat: number,
    lng: number,
    segmentEndId?: string
  ) => {
    setRoutePoints((prev) => {
      const current = normalizeMapRoutePoints(prev);
      const index = current.findIndex((point) => point.id === segmentStartId);
      if (index < 0) return current;
      const segmentStart = current[index];
      const segmentEnd = segmentEndId ? current.find((point) => point.id === segmentEndId) : null;
      const nextPoint: MapRoutePoint = {
        id: `route-point-${Date.now()}`,
        lat,
        lng,
        order: index + 1,
        branchFromId: segmentEnd?.branchFromId === segmentStart.id ? segmentStart.id : segmentStart.branchFromId ?? null,
      };
      const next = [...current];
      if (segmentEnd && segmentEnd.branchFromId === segmentStart.id) {
        next.splice(index + 1, 0, nextPoint);
        const endIndex = next.findIndex((point) => point.id === segmentEnd.id);
        if (endIndex >= 0) {
          next[endIndex] = { ...next[endIndex], branchFromId: nextPoint.id };
        }
      } else {
        next.splice(index + 1, 0, nextPoint);
      }
      const normalized = normalizeMapRoutePoints(next);
      setSelectedKind("route");
      setSelectedId(nextPoint.id);
      return normalized;
    });
  };

  const handleAddConnectedRoutePoint = (pointId: string, branchDirection: "up" | "down" | "auto" = "auto") => {
    setRoutePoints((prev) => {
      const current = normalizeMapRoutePoints(prev);
      const anchor = current.find((point) => point.id === pointId);
      if (!anchor) return current;
      const role = getRoutePointRole(current, pointId);
      let baseLatOffset = 0;
      let baseLngOffset = 0;
      const mainNeighbors = getMainRouteNeighbors(current, pointId);
      const branchParent = getBranchParent(current, pointId);

      if (role === "main-start" && mainNeighbors.next) {
        // 左端: 左側へ延長
        baseLatOffset = anchor.lat - mainNeighbors.next.lat;
        baseLngOffset = anchor.lng - mainNeighbors.next.lng;
      } else if (role === "main-end" && mainNeighbors.previous) {
        // 右端: 右側へ延長
        baseLatOffset = anchor.lat - mainNeighbors.previous.lat;
        baseLngOffset = anchor.lng - mainNeighbors.previous.lng;
      } else if (role === "main-middle" && mainNeighbors.previous && mainNeighbors.next) {
        // 中間点: 上か下へ分岐
        const tangentLat = mainNeighbors.next.lat - mainNeighbors.previous.lat;
        const tangentLng = mainNeighbors.next.lng - mainNeighbors.previous.lng;
        let upLat = tangentLng;
        let upLng = -tangentLat;
        const normalLength = Math.hypot(upLat, upLng);
        if (normalLength > 0) {
          upLat /= normalLength;
          upLng /= normalLength;
        }
        if (upLat < 0) {
          upLat *= -1;
          upLng *= -1;
        }

        const prevDistance = Math.hypot(
          anchor.lat - mainNeighbors.previous.lat,
          anchor.lng - mainNeighbors.previous.lng
        );
        const nextDistance = Math.hypot(
          mainNeighbors.next.lat - anchor.lat,
          mainNeighbors.next.lng - anchor.lng
        );
        const baseDistance = Math.max(0.00012, (prevDistance + nextDistance) / 2);
        const direction = branchDirection === "down" ? -1 : 1;
        baseLatOffset = upLat * baseDistance * direction;
        baseLngOffset = upLng * baseDistance * direction;
      } else if (role === "branch" && branchParent) {
        // 枝点: 親からのベクトルを延長
        baseLatOffset = anchor.lat - branchParent.lat;
        baseLngOffset = anchor.lng - branchParent.lng;
      } else {
        baseLngOffset = 0.00018;
      }

      const nextPoint: MapRoutePoint = {
        id: `route-point-${Date.now()}`,
        lat: anchor.lat + (Math.abs(baseLatOffset) > 0 ? baseLatOffset : 0),
        lng: anchor.lng + (Math.abs(baseLngOffset) > 0 ? baseLngOffset : 0.00018),
        order: current.length,
        branchFromId: role === "main-middle" || role === "branch" ? anchor.id : null,
      };

      const next = [...current];
      if (role === "main-middle" || role === "branch") {
        next.push(nextPoint);
      } else {
        const index = current.findIndex((point) => point.id === pointId);
        next.splice(index + 1, 0, nextPoint);
      }

      const normalized = normalizeMapRoutePoints(next);
      setSelectedKind("route");
      setSelectedId(nextPoint.id);
      return normalized;
    });
  };

  const formatSnapshotDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatSavedTime = (value: string | null) => {
    if (!value) return "未保存";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "未保存";
    return new Intl.DateTimeFormat("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const taskTabs = [
    { key: "shop" as const, label: "店舗マーカ", count: shops.length },
    { key: "landmark" as const, label: "建物", count: landmarks.length },
    { key: "route" as const, label: "道路", count: routePoints.length },
  ];

  const mapEditHint =
    selectedKind === "shop"
      ? "店舗マーカをクリックして選択。選択中のマーカはドラッグで移動できます。"
      : selectedKind === "landmark"
        ? "建物をクリックして選択。選択中の建物はドラッグで移動できます。"
        : "道路ポイントをドラッグして移動。線上の + で追加、点を押すと道を追加できます。";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-slate-100">
      <div className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-start gap-3">
          <div className="pl-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-700">Map Admin</p>
            <h1 className="text-2xl font-bold text-slate-900">マップ管理</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  hasUnsavedChanges ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {hasUnsavedChanges ? "未保存の変更あり" : "保存済み"}
              </span>
              <span className="text-xs text-slate-500">最後に反映: {formatSavedTime(lastSavedAt)}</span>
            </div>
          </div>
          <div className="ml-auto mr-16 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetToLastSaved}
              disabled={!hasUnsavedChanges || isSaving || isLoading}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              保存済みに戻す
            </button>
            <button
              type="button"
              onClick={handleOpenHistory}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              履歴
            </button>
            <div className="flex rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  mode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                プレビュー
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSaving ? "保存中..." : "変更を保存"}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 overflow-hidden px-4 pt-4 ${
          isHistoryOpen
            ? "lg:grid-cols-[320px_360px_1fr]"
            : "lg:grid-cols-[360px_1fr]"
        }`}
      >
        {isHistoryOpen && (
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Backup History</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">保存履歴</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="履歴を閉じる"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              復元は、現在のマップを保存済みの状態でのみ実行できます。
            </p>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {isLoadingSnapshots ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  履歴を読み込み中です。
                </div>
              ) : snapshots.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  保存履歴はまだありません。
                </div>
              ) : (
                snapshots.map((snapshot) => (
                  <div key={snapshot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatSnapshotDate(snapshot.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">ID: {snapshot.id}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      店舗更新 {snapshot.summary?.updatedShopCount ?? 0}件 / 店舗削除 {snapshot.summary?.deletedShopCount ?? 0}件
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      建物更新 {snapshot.summary?.upsertLandmarkCount ?? 0}件 / 建物削除 {snapshot.summary?.deletedLandmarkCount ?? 0}件
                    </p>
                    {snapshot.summary?.restoreSourceSnapshotId && (
                      <p className="mt-1 text-xs text-amber-700">
                        復元前バックアップ
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(snapshot.id)}
                      disabled={hasUnsavedChanges || isRestoring !== null}
                      className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {isRestoring === snapshot.id ? "復元中..." : "この状態に復元"}
                    </button>
                    {hasUnsavedChanges && (
                      <p className="mt-2 text-[11px] text-rose-600">
                        現在の変更を保存してから復元してください。
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
        <aside className="flex min-h-0 flex-col overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2">
            {taskTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSelectedKind(tab.key)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  selectedKind === tab.key
                    ? "border-sky-200 bg-sky-50 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-sm font-semibold ${selectedKind === tab.key ? "text-sky-900" : "text-slate-700"}`}>
                    {tab.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {tab.count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedKind === tab.key ? "編集中" : "切り替える"}
                </p>
              </button>
            ))}
          </div>

          {selectedKind === "shop" ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={handleAddShop}
                className="w-full rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
              >
                ＋店舗マーカを追加
              </button>
              <input
                type="search"
                value={shopQuery}
                onChange={(event) => setShopQuery(event.target.value)}
                placeholder="店舗マーカを検索"
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {filteredShops.map((shop) => (
                  <div
                    key={shop.id}
                    ref={(node) => {
                      shopItemRefs.current[String(shop.id)] = node;
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleShopSelection(shop.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleShopSelection(shop.id);
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        selectedId === String(shop.id)
                          ? "border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-200"
                          : "border-slate-200 bg-white"
                      } cursor-pointer`}
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{shop.name}</span>
                          <span className="block text-xs text-slate-500">#{shop.id}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteShop(shop.id);
                        }}
                        className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        aria-label={`${shop.name} を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {selectedId === String(shop.id) && (
                      <div
                        className="mt-2 rounded-2xl bg-slate-50 p-4"
                        onClick={(event) => event.stopPropagation()}
                      >
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      出店者
                    </label>
                    <select
                      value={shop.vendorId ?? ""}
                      onChange={(event) =>
                        setShops((prev) =>
                          prev.map((item) => {
                            if (item.id !== shop.id) return item;
                            const vendorId = event.target.value || undefined;
                            const vendorName =
                              vendorOptions.find((vendor) => vendor.id === vendorId)?.name ??
                              `未設定店舗 ${item.position}`;
                            return {
                              ...item,
                              vendorId,
                              name: vendorId ? vendorName : `未設定店舗 ${item.position}`,
                            };
                          })
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">未割当</option>
                      {vendorOptions.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        緯度
                        <input
                          type="number"
                          step="0.000001"
                          value={shop.lat}
                          onChange={(event) =>
                            setShops((prev) =>
                              prev.map((item) =>
                                item.id === shop.id
                                  ? { ...item, lat: Number(event.target.value) }
                                  : item
                              )
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        />
                      </label>
                      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        経度
                        <input
                          type="number"
                          step="0.000001"
                          value={shop.lng}
                          onChange={(event) =>
                            setShops((prev) =>
                              prev.map((item) =>
                                item.id === shop.id
                                  ? { ...item, lng: Number(event.target.value) }
                                  : item
                              )
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancelShop(shop.id)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          shop.locationId.startsWith("new-")
                            ? handleConfirmNewShop(shop.id)
                            : handleConfirmShop(shop.id)
                        }
                        className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                      >
                        確定
                      </button>
                    </div>
                      </div>
                    )}
                  </div>
                ))}
                {filteredShops.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    該当する店舗マーカはありません。
                  </div>
                )}
              </div>
            </div>
          ) : selectedKind === "landmark" ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                onClick={handleAddLandmark}
                className="w-full rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
              >
                ＋建物を追加
              </button>
              <input
                type="search"
                value={landmarkQuery}
                onChange={(event) => setLandmarkQuery(event.target.value)}
                placeholder="建物オブジェクトを検索"
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredLandmarks.map((landmark) => (
                <div
                  key={landmark.key}
                  ref={(node) => {
                    landmarkItemRefs.current[landmark.key] = node;
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleLandmarkSelection(landmark.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleLandmarkSelection(landmark.key);
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    selectedId === landmark.key
                      ? "border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-200"
                      : "border-slate-200 bg-white"
                  } cursor-pointer`}
                >
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-slate-900">{landmark.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteLandmark(landmark.key);
                    }}
                    className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                    aria-label={`${landmark.name} を削除`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {filteredLandmarks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  該当する建物オブジェクトはありません。
                </div>
              )}
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={handleAddRoutePoint}
                className="w-full rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700"
              >
                ＋道路ポイントを追加
              </button>
              <input
                type="search"
                value={routeQuery}
                onChange={(event) => setRouteQuery(event.target.value)}
                placeholder="ポイント番号や状態で検索"
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Points</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{routePoints.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Length</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{routeLengthKm.toFixed(2)}km</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {selectedRoutePoint ? routePoints.findIndex((point) => point.id === selectedRoutePoint.id) + 1 : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Road Settings
                  </p>
                  <p className="text-[11px] text-slate-400">よく使う設定だけ先に表示しています</p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    道幅の半径(m)
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={routeConfig.roadHalfWidthMeters}
                      onChange={(event) =>
                        setRouteConfig((prev) => ({
                          ...prev,
                          roadHalfWidthMeters: Number(event.target.value),
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                </div>
                <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    詳細設定を開く
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      スナップ開始距離(m)
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={routeConfig.snapDistanceMeters}
                        onChange={(event) =>
                          setRouteConfig((prev) => ({
                            ...prev,
                            snapDistanceMeters: Number(event.target.value),
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      最大表示距離(m)
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        value={routeConfig.visibleDistanceMeters}
                        onChange={(event) =>
                          setRouteConfig((prev) => ({
                            ...prev,
                            visibleDistanceMeters: Number(event.target.value),
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                  </div>
                </details>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Road Points
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    ポイントを選ぶと、その場で座標を編集できます。
                  </p>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {filteredRoutePoints.map((point, index) => {
                    const pointStatus = getRoutePointStatus(routePoints, point.id);
                    return (
                      <div
                        key={point.id}
                        ref={(node) => {
                          routePointItemRefs.current[point.id] = node;
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleRouteSelection(point.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleRouteSelection(point.id);
                            }
                          }}
                          className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            selectedId === point.id
                              ? "border-sky-400 bg-sky-50 shadow-sm ring-2 ring-sky-200"
                              : "border-slate-200 bg-white"
                          } cursor-pointer`}
                        >
                          <div className="min-w-0 flex-1 text-left">
                            <span className="flex items-center gap-2">
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-[11px] font-bold text-white">
                                {index + 1}
                              </span>
                              <span className="block text-sm font-semibold text-slate-900">
                                ポイント {index + 1}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                {pointStatus?.label ?? "未判定"}
                              </span>
                            </span>
                            <span className="mt-2 block text-xs text-slate-500">
                              緯度 {point.lat.toFixed(6)} / 経度 {point.lng.toFixed(6)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteRoutePoint(point.id);
                            }}
                            className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                            aria-label={`道路ポイント ${index + 1} を削除`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {selectedId === point.id && (
                          <div
                            className="mt-2 rounded-2xl bg-slate-50 p-4"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Status
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {pointStatus?.label ?? "未判定"}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {pointStatus?.description ?? "このポイントの状態を確認できます。"}
                              </p>
                              {point.branchFromId && (
                                <p className="mt-2 text-[11px] text-slate-400">分岐元 ID: {point.branchFromId}</p>
                              )}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                緯度
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={point.lat}
                                  onChange={(event) =>
                                    setRoutePoints((prev) =>
                                      normalizeMapRoutePoints(
                                        prev.map((item) =>
                                          item.id === point.id
                                            ? { ...item, lat: Number(event.target.value) }
                                            : item
                                        )
                                      )
                                    )
                                  }
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                />
                              </label>
                              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                経度
                                <input
                                  type="number"
                                  step="0.000001"
                                  value={point.lng}
                                  onChange={(event) =>
                                    setRoutePoints((prev) =>
                                      normalizeMapRoutePoints(
                                        prev.map((item) =>
                                          item.id === point.id
                                            ? { ...item, lng: Number(event.target.value) }
                                            : item
                                        )
                                      )
                                    )
                                  }
                                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredRoutePoints.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                      道路ポイントがまだありません。
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedLandmark && selectedKind === "landmark" && (
            <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4">
              <input
                value={selectedLandmark.name}
                onChange={(event) =>
                  setLandmarks((prev) =>
                    prev.map((item) =>
                      item.key === selectedLandmark.key ? { ...item, name: event.target.value } : item
                    )
                  )
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={selectedLandmark.description}
                onChange={(event) =>
                  setLandmarks((prev) =>
                    prev.map((item) =>
                      item.key === selectedLandmark.key ? { ...item, description: event.target.value } : item
                    )
                  )
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={selectedLandmark.url}
                onChange={(event) =>
                  setLandmarks((prev) =>
                    prev.map((item) =>
                      item.key === selectedLandmark.key ? { ...item, url: event.target.value } : item
                    )
                  )
                }
                placeholder="画像URL"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCancelLandmark(selectedLandmark.key)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmLandmark(selectedLandmark.key)}
                  className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  確定
                </button>
              </div>
              <p className="text-xs text-slate-500">建物オブジェクトはDBに保存され、マップ表示へ反映されます。</p>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {message}
            </div>
          )}
        </aside>

        <div className="min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <MapLayoutEditor
            mode={mode}
            shops={shops}
            landmarks={landmarks}
            routePoints={routePoints}
            routeConfig={routeConfig}
            interactionHint={mapEditHint}
            maxZoom={mapSettings.maxEditZoom}
            selectedKind={selectedKind}
            selectedId={selectedId}
            onSelect={(kind, id) => {
              if (selectedKind === kind && selectedId === id) {
                setSelectedId("");
                return;
              }
              setSelectedKind(kind);
              setSelectedId(id);
            }}
            onClearSelection={() => setSelectedId("")}
            onMoveShop={(id, lat, lng) =>
              setShops((prev) => prev.map((shop) => (shop.id === id ? { ...shop, lat, lng } : shop)))
            }
            onMoveLandmark={(key, lat, lng) =>
              setLandmarks((prev) => prev.map((item) => (item.key === key ? { ...item, lat, lng } : item)))
            }
            onMoveRoutePoint={(id, lat, lng) =>
              setRoutePoints((prev) => stabilizeRoutePointMove(prev, id, lat, lng))
            }
            onInsertRoutePointAtSegment={handleInsertRoutePointAtSegment}
            onAddConnectedRoutePoint={handleAddConnectedRoutePoint}
            onDeleteShop={handleDeleteShop}
            onDeleteLandmark={handleDeleteLandmark}
            onDeleteRoutePoint={handleDeleteRoutePoint}
          />
        </div>
      </div>
    </div>
  );
}
