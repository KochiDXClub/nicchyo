/**
 * Optimized shop layer (non-clustered).
 * Uses Leaflet canvas markers to reduce DOM work.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Shop } from '../data/shops';

interface OptimizedShopLayerProps {
  shops: Shop[];
  onShopClick: (shop: Shop) => void;
  selectedShopId?: number;
}

export default function OptimizedShopLayer({
  shops,
  onShopClick,
  selectedShopId,
}: OptimizedShopLayerProps) {
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<number, L.CircleMarker>>(new Map());

  useEffect(() => {
    const layerGroup = L.layerGroup();
    layerGroupRef.current = layerGroup;
    // cleanup 時に ref が変化している可能性に備え、この effect 実行時点の
    // markers Map をローカルに退避して cleanup でもそれを使う
    const markers = markersRef.current;

    const canvasRenderer = L.canvas({ padding: 0.5 });

    shops.forEach((shop) => {
      const marker = L.circleMarker([shop.lat, shop.lng], {
        renderer: canvasRenderer,
        radius: 8,
        fillColor: getCategoryColor(shop.category),
        fillOpacity: 0.8,
        color: '#fff',
        weight: 2,
      });

      marker.on('click', () => {
        onShopClick(shop);
      });

      marker.bindTooltip(shop.name, {
        permanent: false,
        direction: 'top',
        offset: [0, -10],
      });

      layerGroup.addLayer(marker);
      markers.set(shop.id, marker);
    });

    map.addLayer(layerGroup);

    return () => {
      map.removeLayer(layerGroup);
      layerGroupRef.current = null;
      markers.clear();
    };
  }, [shops, map, onShopClick]);

  useEffect(() => {
    markersRef.current.forEach((marker, shopId) => {
      if (shopId === selectedShopId) {
        marker.setStyle({
          radius: 12,
          weight: 3,
          fillOpacity: 1.0,
        });
      } else {
        marker.setStyle({
          radius: 8,
          weight: 2,
          fillOpacity: 0.8,
        });
      }
    });
  }, [selectedShopId]);

  return null;
}

function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    '食材': '#22c55e',
    '食べ物': '#f59e0b',
    '道具・工具': '#3b82f6',
    '生活雑貨': '#8b5cf6',
    '植物・苗': '#10b981',
    'アクセサリー': '#ec4899',
    '手作り・工芸': '#f97316',
  };

  return colorMap[category] || '#6b7280';
}
