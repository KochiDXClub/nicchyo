'use client';

/**
 * useFacilityGuide
 *
 * 「おでかけサポート」で選ばれたカテゴリに対して、
 * 表示する施設・現在地・最寄り施設をまとめて返す。
 *
 * 現在地は MapPageClient が持つ userLocation を使わず、ここで独自に取得する。
 * UserLocationMarker は測位に失敗したときに会場中心の座標をフォールバックとして
 * 通知するため、それをそのまま使うと「現在地が取れていないのに最寄りを断定する」
 * ことになってしまうため。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  getFacilitiesByCategory,
  getFacilityCategory,
  type FacilityCategoryId,
} from '@/lib/facilities/facilities';
import { getTransitFacilities } from '@/lib/facilities/transitLandmarks';
import { rankFacilitiesByWalk, type LatLng } from '@/lib/facilities/nearest';
import { getRoadCenterlinePoints } from '../config/roadConfig';
import type { Landmark } from '../types/landmark';

export type FacilityGuide = ReturnType<typeof useFacilityGuide>;

/**
 * @param landmarks マップ上のランドマーク（map_landmarks）。「のりもの」カテゴリの
 *   施設は静的データを持たず、ここから電停・JR駅を変換して補う
 *   （lib/facilities/transitLandmarks.ts 参照）。
 */
export function useFacilityGuide(categoryId: FacilityCategoryId | null, landmarks: Landmark[] = []) {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!categoryId) {
      setUserLocation(null);
      return;
    }
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // 許可されない・取得できない場合は現在地なしのまま案内する
        if (!cancelled) setUserLocation(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  const category = useMemo(
    () => (categoryId ? getFacilityCategory(categoryId) ?? null : null),
    [categoryId]
  );

  const facilities = useMemo(() => {
    if (!categoryId) return [];
    if (categoryId === 'transport') return getTransitFacilities(landmarks);
    return getFacilitiesByCategory(categoryId);
  }, [categoryId, landmarks]);

  // 追手筋のセンターライン。これに沿わせて道なりの道すじを作る
  const centerline = useMemo(() => getRoadCenterlinePoints(), []);

  /** 現在地からの道のりが近い順。現在地が無いときは空 */
  const ranked = useMemo(
    () =>
      categoryId && userLocation
        ? rankFacilitiesByWalk(userLocation, categoryId, facilities, centerline)
        : [],
    [categoryId, centerline, facilities, userLocation]
  );

  const nearest = ranked[0] ?? null;

  return { category, facilities, ranked, nearest, userLocation };
}
