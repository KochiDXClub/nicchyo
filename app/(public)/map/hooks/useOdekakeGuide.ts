'use client';

/**
 * useOdekakeGuide
 *
 * おでかけサポートの状態をまとめて持つフック。
 *
 *   URL（?guide= / ?facility=）→ 初期の種別・条件
 *   種別・条件チップ / 起点の切り替え / 選択中スポット / 案内中 … は画面側の状態
 *   経路・順位の計算は lib/guide（案内エンジン）に委ねる
 *
 * 起点は端末の現在地。会場の外にいてもそこから道なりの経路・距離・時間を出す。
 * 現在地が取れないときだけ地図の中心（それも無ければ会場の中心）を使う。
 * 案内が開いている間は watchPosition で現在地を追い、残り距離を更新する。
 * 小さな測位のゆらぎで起点が動かないよう、一定以上動いたときだけ更新する。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Landmark } from '../types/landmark';
import type { MapCamera } from '../types/mapCamera';
import type { MapRoute } from '../types/mapRoute';
import { landmarkToSpot, type MapSpot, type SpotKind } from '@/lib/spots';
import { distanceInMeters, type LatLng } from '@/lib/facilities/geo';
import {
  buildGuideNetworkForMap,
  GUIDE_PRESETS,
  rankSpots,
  resolveOrigin,
  type GuideNetwork,
  type GuideOrigin,
  type RankedSpot,
  type WalkNetworkData,
} from '@/lib/guide';
import type { GuideQuery } from '@/lib/guide/query';

/** この距離以内に近づいたら「到着」 */
const ARRIVAL_METERS = 25;
/** 測位の更新がこの距離未満なら起点を動かさない（ゆらぎで経路がブレるのを防ぐ） */
const ORIGIN_MOVE_THRESHOLD_METERS = 8;
/** 上位何件までルート線を薄く描くか（選択中は別に濃く描く） */
const FAINT_ROUTE_COUNT = 3;

export type GuideKindOption = { kind: SpotKind; label: string; emoji: string };

export const GUIDE_KIND_OPTIONS: GuideKindOption[] = [
  { kind: 'restroom', label: 'お手洗い', emoji: '🚻' },
  { kind: 'rest', label: '休けい', emoji: '🌿' },
  { kind: 'transit', label: 'のりもの', emoji: '🚋' },
  { kind: 'landmark', label: '目印', emoji: '🏯' },
];

type Geolocation = { point: LatLng; accuracyMeters?: number };

export function useOdekakeGuide({
  query,
  landmarks,
  mapRoute,
  map,
}: {
  /** null なら案内は閉じている */
  query: GuideQuery | null;
  landmarks: Landmark[];
  mapRoute: MapRoute | undefined;
  map: MapCamera | null;
}) {
  const active = query !== null;

  // ── 種別・条件（URL から初期化し、画面のチップで変える） ──
  const [kinds, setKinds] = useState<SpotKind[]>(query?.kinds ?? []);
  const [anyTags, setAnyTags] = useState<string[]>(query?.requiredAnyTags ?? []);
  const queryKey = query ? `${query.presetId ?? ''}|${query.kinds.join(',')}|${query.requiredAnyTags.join(',')}` : '';
  const lastQueryKeyRef = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKeyRef.current === queryKey) return;
    lastQueryKeyRef.current = queryKey;
    setKinds(query?.kinds ?? []);
    setAnyTags(query?.requiredAnyTags ?? []);
    setSelectedId(null);
    setNavigating(false);
  }, [query, queryKey]);

  const toggleKind = useCallback((kind: SpotKind) => {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
    setSelectedId(null);
  }, []);
  const toggleAnyTag = useCallback((tag: string) => {
    setAnyTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);
  const applyPreset = useCallback((presetId: string) => {
    const preset = GUIDE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setKinds([...preset.kinds]);
    setAnyTags([...(preset.requiredAnyTags ?? [])]);
    setSelectedId(null);
  }, []);

  // ── 選択・案内中 ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  // ── 現在地（案内が開いている間だけ追う） ──
  const [geolocation, setGeolocation] = useState<Geolocation | null>(null);
  useEffect(() => {
    if (!active) {
      setGeolocation(null);
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
        setGeolocation((prev) => {
          if (prev && distanceInMeters(prev.point, point) < ORIGIN_MOVE_THRESHOLD_METERS) return prev;
          return { point, accuracyMeters: position.coords.accuracy };
        });
      },
      () => setGeolocation(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [active]);

  // ── 地図の中心（現在地が取れないときだけ使う。動かしたときに更新） ──
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!map || !active) return;
    const update = () => {
      const center = map.getCenter();
      setMapCenter({ lat: center.lat, lng: center.lng });
    };
    update();
    map.on('moveend', update);
    return () => {
      map.off('moveend', update);
    };
  }, [map, active]);

  const hasGeolocation = geolocation !== null;
  const origin: GuideOrigin | null = useMemo(() => {
    if (!active) return null;
    return resolveOrigin({ geolocation, mapCenter: geolocation ? null : mapCenter });
  }, [active, geolocation, mapCenter]);

  // ── スポットと道のネットワーク ──
  const spots = useMemo(() => landmarks.map(landmarkToSpot), [landmarks]);
  // 歩行者ネットワーク（約270KB）は案内を開いたときに初めて読み込む
  const [walkData, setWalkData] = useState<WalkNetworkData | null>(null);
  useEffect(() => {
    if (!active || walkData) return;
    let cancelled = false;
    void import('@/lib/guide/data/kochi-walk-network.json').then((mod) => {
      if (!cancelled) setWalkData(mod.default as WalkNetworkData);
    });
    return () => {
      cancelled = true;
    };
  }, [active, walkData]);
  const network: GuideNetwork | null = useMemo(
    () => (active ? buildGuideNetworkForMap(walkData, mapRoute ?? null) : null),
    [active, mapRoute, walkData]
  );

  const ranked: RankedSpot[] = useMemo(() => {
    if (!active || kinds.length === 0) return [];
    return rankSpots(spots, {
      origin,
      network,
      kinds,
      requiredAnyTags: anyTags,
      preferTags: query?.preferTags,
      hideClosed: query?.hideClosed,
    });
  }, [active, anyTags, kinds, network, origin, query?.hideClosed, query?.preferTags, spots]);

  /** いま選べる条件タグ（表示中の種別のスポットが持つタグの和集合） */
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const spot of spots) {
      if (kinds.includes(spot.kind)) for (const tag of spot.tags ?? []) tags.add(tag);
    }
    return Array.from(tags);
  }, [kinds, spots]);

  const selected = useMemo(() => ranked.find((entry) => entry.spot.id === selectedId) ?? null, [ranked, selectedId]);
  const nearest = ranked[0] ?? null;

  /** 描く経路（上位数件は薄く、選択中は濃く） */
  const routes = useMemo(() => {
    const faint = ranked
      .slice(0, FAINT_ROUTE_COUNT)
      .filter((entry) => entry.route && entry.spot.id !== selectedId)
      .map((entry) => ({ id: entry.spot.id, points: entry.route!.points, color: entry.spot.accentColor, emphasis: 'faint' as const }));
    const strong = selected?.route
      ? [{ id: selected.spot.id, points: selected.route.points, color: selected.spot.accentColor, emphasis: 'strong' as const }]
      : [];
    return [...faint, ...strong];
  }, [ranked, selected, selectedId]);

  // 出発時の距離を覚えておき、進み具合（0〜1）を出す
  const startDistanceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigating) startDistanceRef.current = null;
  }, [navigating, selectedId]);
  const remaining = selected?.route?.distanceMeters ?? null;
  if (navigating && remaining !== null && startDistanceRef.current === null) startDistanceRef.current = remaining;
  const progress =
    navigating && remaining !== null && startDistanceRef.current
      ? Math.min(1, Math.max(0, 1 - remaining / startDistanceRef.current))
      : 0;

  const arrived = useMemo(() => {
    if (!navigating || !selected || !origin || origin.type !== 'geolocation') return false;
    return distanceInMeters(origin.point, selected.spot) <= ARRIVAL_METERS;
  }, [navigating, origin, selected]);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id === null) setNavigating(false);
  }, []);

  const startNavigation = useCallback(
    (spot: MapSpot) => {
      if (!kinds.includes(spot.kind)) setKinds((prev) => (prev.includes(spot.kind) ? prev : [...prev, spot.kind]));
      setSelectedId(spot.id);
      setNavigating(true);
    },
    [kinds]
  );
  const stopNavigation = useCallback(() => setNavigating(false), []);

  return {
    active,
    presetId: query?.presetId ?? null,
    kinds,
    toggleKind,
    anyTags,
    toggleAnyTag,
    availableTags,
    applyPreset,
    origin,
    hasGeolocation,
    spots,
    ranked,
    nearest,
    selected,
    selectedId,
    select,
    routes,
    navigating,
    startNavigation,
    stopNavigation,
    arrived,
    progress,
  };
}

export type OdekakeGuide = ReturnType<typeof useOdekakeGuide>;
