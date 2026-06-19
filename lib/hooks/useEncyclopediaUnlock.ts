"use client";

import { useEffect, useRef } from 'react';
import { ENCYCLOPEDIA_ITEMS } from '@/data/encyclopediaItems';
import { unlockItem, getUnlockedItemIds } from '@/lib/storage/encyclopedia';
import toast from 'react-hot-toast';

export function useEncyclopediaUnlock(userLocation: { lat: number; lng: number } | null) {
  const lastProcessedLocation = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!userLocation) return;

    // 前回の判定位置から一定距離（例: 10m）動いていない場合は判定をスキップ
    if (lastProcessedLocation.current) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        lastProcessedLocation.current.lat,
        lastProcessedLocation.current.lng
      );
      if (dist < 10) return;
    }

    lastProcessedLocation.current = userLocation;
    const unlockedIdSet = new Set(getUnlockedItemIds());

    ENCYCLOPEDIA_ITEMS.forEach((item) => {
      // すでに解放済み、またはGPSトリガーでない場合はスキップ
      if (unlockedIdSet.has(item.id)) return;
      if (item.trigger.type !== 'gps' && item.trigger.type !== 'both') return;
      if (item.trigger.lat === undefined || item.trigger.lng === undefined) return;

      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        item.trigger.lat,
        item.trigger.lng
      );

      if (distance <= (item.trigger.radius || 100)) {
        const isNew = unlockItem(item.id);
        if (isNew) {
          toast.success(`新発見！「${item.name}」を図鑑に登録しました`, {
            icon: item.emoji,
            duration: 5000,
          });
        }
      }
    });
  }, [userLocation]);
}

/**
 * 2点間の距離を計算（メートル）
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // 地球の半径 (m)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
