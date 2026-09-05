'use client';

/**
 * useOdekakeGuide
 *
 * おでかけサポートの状態をまとめて持つフック。
 *
 *   URL（?guide=menu / ?facility=）→ 初期の種類
 *   種類・条件チップ / 選択中スポット / 案内中 … は画面側の状態
 *   経路・順位の計算は lib/guide（案内エンジン）に委ねる
 *
 * 起点は端末の現在地だけ。会場の外にいてもそこから道なりの経路・距離・時間を出す。
 * 位置情報が許可されていない・取れていないときは、適当な場所から経路を出さず、
 * 状態（geoStatus）を画面に出して許可・再試行を促す。
 * 案内が開いている間は watchPosition で現在地を追い、残り距離を更新する。
 * 小さな測位のゆらぎで起点が動かないよう、一定以上動いたときだけ更新する。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Landmark } from '../types/landmark';
import type { MapRoute } from '../types/mapRoute';
import { landmarkToSpot, type MapSpot, type SpotKind } from '@/lib/spots';
import { distanceInMeters, type LatLng } from '@/lib/facilities/geo';
import {
  buildGuideNetworkForMap,
  geolocationOrigin,
  rankSpots,
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

/**
 * 位置情報の状態
 *   checking    : 許可状態を調べている
 *   prompt      : まだ許可を求めていない（ボタンで求める）
 *   requesting  : 許可を求めている / 取得中
 *   granted     : 取得できている
 *   denied      : 許可されていない
 *   error       : 取得に失敗した（タイムアウト・測位不能）
 *   unsupported : この端末では使えない
 */
export type GeoStatus = 'checking' | 'prompt' | 'requesting' | 'granted' | 'denied' | 'error' | 'unsupported';

/**
 * 内容が同じなら前と同じ参照を返す。配列や経路を毎回作り直すと、描画側の effect が
 * そのたびに走ってマーカーや線が消えては出る（点滅する）ため、キーで比較して抑える。
 */
function useStableByKey<T>(value: T, key: string): T {
  const ref = useRef<{ key: string; value: T }>({ key, value });
  if (ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

const pointKey = (point: LatLng) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

export function useOdekakeGuide({
  query,
  landmarks,
  mapRoute,
}: {
  /** null なら案内は閉じている */
  query: GuideQuery | null;
  landmarks: Landmark[];
  mapRoute: MapRoute | undefined;
}) {
  const active = query !== null;

  // ── 種類・条件（URL から初期化し、画面のチップで変える） ──
  const [kinds, setKinds] = useState<SpotKind[]>(query?.kinds ?? []);
  const [anyTags, setAnyTags] = useState<string[]>([]);
  // 閉じているとき（null）と ?guide=menu（種類なし）を区別し、閉じて開き直したときも
  // 選択・案内中の状態をリセットする
  const queryKey = query ? `open:${query.kinds.join(',')}` : 'closed';
  const lastQueryKeyRef = useRef(queryKey);
  useEffect(() => {
    if (lastQueryKeyRef.current === queryKey) return;
    lastQueryKeyRef.current = queryKey;
    setKinds(query?.kinds ?? []);
    setAnyTags([]);
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

  // ── 選択・案内中 ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  // ── 現在地（案内が開いている間だけ追う） ──
  const [geolocation, setGeolocation] = useState<Geolocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('checking');
  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  /** 位置情報の取得を始める。未許可ならブラウザの許可ダイアログが出る（ユーザー操作から呼ぶ） */
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    stopWatching();
    setGeoStatus((prev) => (prev === 'granted' ? prev : 'requesting'));
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;
        setGeoStatus('granted');
        setGeolocation((prev) => {
          if (prev && distanceInMeters(prev.point, point) < ORIGIN_MOVE_THRESHOLD_METERS) return prev;
          return { point, accuracyMeters: position.coords.accuracy };
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocation(null);
          setGeoStatus('denied');
          return;
        }
        // 一度取れた現在地は、後のタイムアウト等のエラーでは捨てない（起点がブレるため）。
        // まだ取れていなければ「取得に失敗」として再試行を促す
        setGeolocation((prev) => {
          if (!prev) setGeoStatus('error');
          return prev;
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [stopWatching]);

  useEffect(() => {
    if (!active) {
      stopWatching();
      setGeolocation(null);
      setGeoStatus('checking');
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    let cancelled = false;
    let permission: PermissionStatus | null = null;
    const applyState = (state: PermissionState) => {
      if (cancelled) return;
      if (state === 'granted') requestLocation();
      else if (state === 'denied') {
        stopWatching();
        setGeolocation(null);
        setGeoStatus('denied');
      } else setGeoStatus('prompt');
    };
    // 許可済みなら黙って取得を始め、未許可ならボタンで求める（Permissions API が無い端末は
    // 状態が分からないのでボタンを出す）
    if (typeof navigator.permissions?.query === 'function') {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permission = status;
          applyState(status.state);
          status.onchange = () => applyState(status.state);
        })
        .catch(() => applyState('prompt'));
    } else {
      applyState('prompt');
    }
    return () => {
      cancelled = true;
      if (permission) permission.onchange = null;
      stopWatching();
    };
  }, [active, requestLocation, stopWatching]);

  // 許可ダイアログが放置された等で「取得中」のまま止まらないよう、一定時間で失敗扱いにする
  useEffect(() => {
    if (geoStatus !== 'requesting') return;
    const timer = window.setTimeout(() => setGeoStatus((prev) => (prev === 'requesting' ? 'error' : prev)), 20000);
    return () => window.clearTimeout(timer);
  }, [geoStatus]);

  const hasGeolocation = geolocation !== null;
  // 起点は端末の現在地だけ。取れていないときは経路を出さない
  const origin: GuideOrigin | null = useMemo(() => {
    if (!active || !geolocation) return null;
    return geolocationOrigin(geolocation.point, geolocation.accuracyMeters);
  }, [active, geolocation]);

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
    });
  }, [active, anyTags, kinds, network, origin, spots]);

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

  /** マップに描くスポット（表示中の種類のもの）。中身が同じなら同じ配列を返す */
  const visibleSpotsRaw = useMemo(() => ranked.map((entry) => entry.spot), [ranked]);
  const visibleSpots = useStableByKey(visibleSpotsRaw, visibleSpotsRaw.map((spot) => spot.id).join('|'));

  /** 描く経路（上位数件は薄く、選択中は濃く）。折れ線が同じなら同じ配列を返す */
  const routesRaw = useMemo(() => {
    const faint = ranked
      .slice(0, FAINT_ROUTE_COUNT)
      .filter((entry) => entry.route && entry.spot.id !== selectedId)
      .map((entry) => ({ id: entry.spot.id, points: entry.route!.points, color: entry.spot.accentColor, emphasis: 'faint' as const }));
    const strong = selected?.route
      ? [{ id: selected.spot.id, points: selected.route.points, color: selected.spot.accentColor, emphasis: 'strong' as const }]
      : [];
    return [...faint, ...strong];
  }, [ranked, selected, selectedId]);
  const routes = useStableByKey(
    routesRaw,
    routesRaw.map((r) => `${r.id}:${r.emphasis}:${r.points.length}:${pointKey(r.points[0])}:${pointKey(r.points[r.points.length - 1])}`).join('|')
  );

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
      // 現在地が無ければ案内は始めず、許可・取得を求める
      if (!geolocation) {
        requestLocation();
        return;
      }
      setNavigating(true);
    },
    [geolocation, kinds, requestLocation]
  );
  const stopNavigation = useCallback(() => setNavigating(false), []);

  return {
    active,
    kinds,
    toggleKind,
    anyTags,
    toggleAnyTag,
    availableTags,
    origin,
    hasGeolocation,
    geoStatus,
    requestLocation,
    spots,
    visibleSpots,
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
