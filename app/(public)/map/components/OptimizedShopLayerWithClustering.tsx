/**
 * Optimized shop layer with clustering.
 */

'use client';

import { memo, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
// MarkerCluster.Default.css は意図的に除外（青いデフォルトスタイルを排除）
// MarkerCluster.css も除外（zoom≥17では clustering が発生しないため不要）
import { Shop } from '../data/shops';
import {
  ILLUSTRATION_SIZES,
  DEFAULT_ILLUSTRATION_SIZE,
  getIllustrationAnchor,
  getShopMarkerLod,
  getShopMarkerScale,
  type ShopMarkerLod,
} from '../config/displayConfig';
import { getRoadSide } from '../config/roadConfig';
import { getShopBannerImage } from '../../../../lib/shopImages';
import { generateShopMarkerHtml } from '../utils/markerHtmlGenerator';

type ShopBannerOrigin = { x: number; y: number; width: number; height: number };

export interface OptimizedShopLayerWithClusteringProps {
  shops: Shop[];
  onShopClick: (shop: Shop, origin?: ShopBannerOrigin) => void;
  onChunkProgress?: (processed: number, total: number, done: boolean) => void;
  selectedShopId?: number;
  favoriteShopIds?: number[];
  searchShopIds?: number[];
  aiHighlightShopIds?: number[];
  commentHighlightShopIds?: number[];
  bagShopIds?: number[];
  /** 屋台の描画方式（lib/mapFeatureFlags.ts の stallRenderer）。既定は svg */
  stallRenderer?: 'svg' | 'div';
}

const COMPACT_ICON_SIZE: [number, number] = [24, 36];
const COMPACT_ICON_ANCHOR: [number, number] = [12, 18];

/**
 * ShopDetailBanner の開くアニメーションの起点となる矩形。
 *
 * 屋台イラストを起点にする。屋台は LOD に関係なく常に存在し、正方形に近いので
 * 展開演出が素直になる。木札（横長で薄い）を起点にすると、潰れた矩形からの
 * 展開になって不自然に見える。
 * getBoundingClientRect() は transform: scale() 適用後の値を返すため、
 * LOD ごとの実効サイズが自然に反映される。
 */
const getOriginRect = (marker: L.Marker): ShopBannerOrigin | undefined => {
  const element = marker.getElement();
  if (!element) return undefined;
  const target = element.querySelector<HTMLElement>(".shop-illustration") ?? element;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
};

function OptimizedShopLayerWithClustering({
  shops,
  onShopClick,
  onChunkProgress,
  selectedShopId,
  favoriteShopIds,
  searchShopIds,
  aiHighlightShopIds,
  commentHighlightShopIds,
  bagShopIds,
  stallRenderer = 'svg',
}: OptimizedShopLayerWithClusteringProps) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  // アイコンの DOM は2種類だけ。stall / photo / nameplate は同じ DOM を共有し、
  // 何を見せるかは LOD クラスで切り替える。こうすることで setIcon（300件の
  // DOM 作り直し）が dot ↔ stall の1境界でしか起きない。
  const stallIconsRef = useRef<Map<number, L.DivIcon>>(new Map());
  const dotIconsRef = useRef<Map<number, L.DivIcon>>(new Map());
  const favoriteSetRef = useRef<Set<number>>(new Set());
  const prevFavoriteSetRef = useRef<Set<number>>(new Set());
  const searchHighlightSetRef = useRef<Set<number>>(new Set());
  const prevSearchHighlightSetRef = useRef<Set<number>>(new Set());
  const aiHighlightSetRef = useRef<Set<number>>(new Set());
  const prevAiHighlightSetRef = useRef<Set<number>>(new Set());
  const commentHighlightSetRef = useRef<Set<number>>(new Set());
  const prevCommentHighlightSetRef = useRef<Set<number>>(new Set());
  const bagShopSetRef = useRef<Set<number>>(new Set());
  const prevBagShopSetRef = useRef<Set<number>>(new Set());
  const lastLodRef = useRef<ShopMarkerLod | null>(null);
  const lastMarkerZoomScaleRef = useRef<number | null>(null);
  const selectedShopIdRef = useRef<number | undefined>(undefined);

  const setMarkerFavorite = (marker: L.Marker, isFavorite: boolean) => {
    const icon = marker.getElement();
    if (!icon) return;
    if (isFavorite) {
      icon.classList.add('is-favorite');
    } else {
      icon.classList.remove('is-favorite');
    }
  };

  const setMarkerHighlight = (marker: L.Marker, shopId: number, isHighlighted: boolean) => {
    const icon = marker.getElement();
    if (!icon) return;
    if (isHighlighted) {
      icon.classList.add('shop-marker-ai');
      if (selectedShopIdRef.current !== shopId) {
        marker.setZIndexOffset(900);
      }
    } else {
      icon.classList.remove('shop-marker-ai');
      if (selectedShopIdRef.current !== shopId) {
        marker.setZIndexOffset(0);
      }
    }
  };

  const setMarkerSearchHighlight = (
    marker: L.Marker,
    isHighlighted: boolean
  ) => {
    const icon = marker.getElement();
    if (!icon) return;
    if (isHighlighted) {
      icon.classList.add('shop-marker-search');
    } else {
      icon.classList.remove('shop-marker-search');
    }
  };

  const setMarkerCommentHighlight = (marker: L.Marker, isHighlighted: boolean) => {
    const icon = marker.getElement();
    if (!icon) return;
    if (isHighlighted) {
      icon.classList.add('shop-marker-comment');
    } else {
      icon.classList.remove('shop-marker-comment');
    }
  };

  const setMarkerBag = (marker: L.Marker, isHighlighted: boolean) => {
    const icon = marker.getElement();
    if (!icon) return;
    if (isHighlighted) {
      icon.classList.add('shop-marker-bag');
    } else {
      icon.classList.remove('shop-marker-bag');
    }
  };

  /**
   * 表示段階をルート要素のクラスで表す。
   * 何を出すかは CSS 側が加算方式で決める（LOD が上がるほど要素が増える）。
   */
  const setMarkerLod = (marker: L.Marker, lod: ShopMarkerLod) => {
    const icon = marker.getElement();
    if (!icon) return;
    icon.classList.remove(
      'shop-lod-dot',
      'shop-lod-stall',
      'shop-lod-photo',
      'shop-lod-nameplate'
    );
    icon.classList.add(`shop-lod-${lod}`);
  };

  const setMarkerZoomScale = (marker: L.Marker, scale: number) => {
    const icon = marker.getElement();
    if (!icon) return;
    icon.style.setProperty("--shop-marker-zoom-scale", String(scale));
  };

  useEffect(() => {
    selectedShopIdRef.current = selectedShopId;
  }, [selectedShopId]);

  useEffect(() => {
    const markers = L.markerClusterGroup({
      disableClusteringAtZoom: 1,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50,
      iconCreateFunction: (_cluster) => {
        return L.divIcon({
          html: `<div class="cluster-icon cluster-small"></div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
      maxClusterRadius: 80,
      chunkProgress: (processed, total) => {
        onChunkProgress?.(processed, total, processed >= total);
      },
    });

    clusterGroupRef.current = markers;

    // 道の南北で木札とバッジの向きを振り分ける。座標は不変なので生成時に一度だけ計算する。
    const sideClass = (shop: Shop) => `shop-side-${getRoadSide(shop.lat, shop.lng)}`;

    const createDotIcon = (shop: Shop) => {
      return L.divIcon({
        html: `
          <div class="shop-marker-compact-wrapper">
            <div class="shop-favorite-badge" aria-hidden="true">&#10084;</div>
            <div class="shop-marker-compact"></div>
          </div>
        `,
        className: `custom-shop-marker compact-shop-marker ${sideClass(shop)}`,
        iconSize: COMPACT_ICON_SIZE,
        iconAnchor: COMPACT_ICON_ANCHOR,
      });
    };

    /**
     * stall / photo / nameplate で共有するアイコン。
     * 木札も写真アイコンも DOM としては常に含め、表示は LOD クラスで切り替える。
     *
     * iconSize には木札の分を足さない。足すとコンテナの高さが変わって
     * transform-origin: center bottom の原点が屋台の足元からずれ、
     * さらに 300店舗ぶんの不可視ヒット領域が地図のドラッグを妨げるため。
     * 木札は pointer-events: auto を持ち、クリックは _icon にバブリングする。
     */
    const createStallIcon = (shop: Shop) => {
      const sizeKey = shop.illustration?.size ?? DEFAULT_ILLUSTRATION_SIZE;
      const sizeConfig = ILLUSTRATION_SIZES[sizeKey];
      const bannerSeed = shop.position ?? shop.id;
      const bannerImage = shop.images?.main ?? getShopBannerImage(shop.category, bannerSeed);

      return L.divIcon({
        html: generateShopMarkerHtml(shop, {
          bannerImage,
          illustrationSize: sizeKey,
          includeNameplate: true,
          stallRenderer,
        }),
        className: `custom-shop-marker ${sideClass(shop)}`,
        iconSize: [sizeConfig.width, sizeConfig.height],
        iconAnchor: getIllustrationAnchor(sizeKey),
      });
    };

    // 現在のズームに必要なアイコンだけを先に作る。
    // 作った LOD を記録しておかないと、直後の updateMarkerDensity() が
    // 「まだ何も描いていない」と判断して全マーカーに setIcon をやり直してしまう。
    const initialLod = getShopMarkerLod(map.getZoom(), map.getMaxZoom() ?? map.getZoom());
    lastLodRef.current = initialLod;

    // Create a map for fast shop lookup during density updates
    const shopsMap = new Map<number, Shop>(shops.map(s => [s.id, s]));

    shops.forEach((shop) => {
      let initialIcon: L.DivIcon;

      if (initialLod === 'dot') {
        initialIcon = createDotIcon(shop);
        dotIconsRef.current.set(shop.id, initialIcon);
      } else {
        initialIcon = createStallIcon(shop);
        stallIconsRef.current.set(shop.id, initialIcon);
      }

      const marker = L.marker([shop.lat, shop.lng], {
        icon: initialIcon,
      });

      marker.on('click', () => {
        const origin = getOriginRect(marker);
        onShopClick(shop, origin);
      });
      marker.on('add', () => {
        setMarkerFavorite(marker, favoriteSetRef.current.has(shop.id));
        setMarkerHighlight(marker, shop.id, aiHighlightSetRef.current.has(shop.id));
        setMarkerSearchHighlight(marker, searchHighlightSetRef.current.has(shop.id));
        setMarkerCommentHighlight(marker, commentHighlightSetRef.current.has(shop.id));
        setMarkerBag(marker, bagShopSetRef.current.has(shop.id));
        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom() ?? currentZoom;
        setMarkerLod(marker, getShopMarkerLod(currentZoom, maxZoom));
        setMarkerZoomScale(marker, getShopMarkerScale(currentZoom, maxZoom));
      });

      markers.addLayer(marker);
      markersRef.current.set(shop.id, marker);
    });

    const updateMarkerDensity = () => {
      const zoom = map.getZoom();
      const maxZoom = map.getMaxZoom() ?? zoom;
      const nextLod = getShopMarkerLod(zoom, maxZoom);
      const markerZoomScale = getShopMarkerScale(zoom, maxZoom);

      if (
        lastLodRef.current === nextLod &&
        lastMarkerZoomScaleRef.current === markerZoomScale
      ) {
        return;
      }

      // アイコンの DOM を作り直す必要があるのは dot ↔ それ以外の境界だけ。
      // stall / photo / nameplate は同じ DOM をクラスで切り替える。
      const wasDot = lastLodRef.current === 'dot';
      const isDot = nextLod === 'dot';
      const iconChanged = lastLodRef.current === null || wasDot !== isDot;

      lastLodRef.current = nextLod;
      lastMarkerZoomScaleRef.current = markerZoomScale;

      markersRef.current.forEach((marker, shopId) => {
        let icon: L.DivIcon | undefined;

        if (iconChanged) {
          const cache = isDot ? dotIconsRef.current : stallIconsRef.current;
          icon = cache.get(shopId);
          if (!icon) {
            const shop = shopsMap.get(shopId);
            if (shop) {
              icon = isDot ? createDotIcon(shop) : createStallIcon(shop);
              cache.set(shopId, icon);
            }
          }
        }

        if (icon) {
          marker.setIcon(icon);
        }

        setMarkerFavorite(marker, favoriteSetRef.current.has(shopId));
        setMarkerLod(marker, nextLod);
        setMarkerZoomScale(marker, markerZoomScale);
        const markerElement = marker.getElement();
        if (markerElement) {
          if (shopId === selectedShopIdRef.current) {
            markerElement.classList.add('shop-marker-selected');
            marker.setZIndexOffset(1000);
          } else {
            markerElement.classList.remove('shop-marker-selected');
            marker.setZIndexOffset(0);
          }
          if (aiHighlightSetRef.current.has(shopId)) {
            markerElement.classList.add('shop-marker-ai');
            if (shopId !== selectedShopIdRef.current) {
              marker.setZIndexOffset(900);
            }
          } else {
            markerElement.classList.remove('shop-marker-ai');
          }
          if (searchHighlightSetRef.current.has(shopId)) {
            markerElement.classList.add('shop-marker-search');
          } else {
            markerElement.classList.remove('shop-marker-search');
          }
          if (commentHighlightSetRef.current.has(shopId)) {
            markerElement.classList.add('shop-marker-comment');
          } else {
            markerElement.classList.remove('shop-marker-comment');
          }
          if (bagShopSetRef.current.has(shopId)) {
            markerElement.classList.add('shop-marker-bag');
          } else {
            markerElement.classList.remove('shop-marker-bag');
          }
        }
      });
    };

    map.on('zoomend', updateMarkerDensity);
    updateMarkerDensity();

    map.addLayer(markers);

    const markersMap = markersRef.current;
    const stallIcons = stallIconsRef.current;
    const dotIcons = dotIconsRef.current;
    return () => {
      map.off('zoomend', updateMarkerDensity);
      map.removeLayer(markers);
      clusterGroupRef.current = null;
      markersMap.clear();
      stallIcons.clear();
      dotIcons.clear();
      lastLodRef.current = null;
      lastMarkerZoomScaleRef.current = null;
    };
  }, [map, onChunkProgress, onShopClick, shops, stallRenderer]);

  useEffect(() => {
    favoriteSetRef.current = new Set(favoriteShopIds ?? []);
    const nextFavorites = favoriteSetRef.current;
    const prevFavorites = prevFavoriteSetRef.current;
    const changed = new Set<number>();

    prevFavorites.forEach((id) => {
      if (!nextFavorites.has(id)) changed.add(id);
    });
    nextFavorites.forEach((id) => {
      if (!prevFavorites.has(id)) changed.add(id);
    });

    changed.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        setMarkerFavorite(marker, nextFavorites.has(id));
      }
    });

    prevFavoriteSetRef.current = nextFavorites;
  }, [favoriteShopIds]);

  useEffect(() => {
    searchHighlightSetRef.current = new Set(searchShopIds ?? []);
    const nextHighlights = searchHighlightSetRef.current;
    const prevHighlights = prevSearchHighlightSetRef.current;
    const changed = new Set<number>();

    prevHighlights.forEach((id) => {
      if (!nextHighlights.has(id)) changed.add(id);
    });
    nextHighlights.forEach((id) => {
      if (!prevHighlights.has(id)) changed.add(id);
    });

    changed.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        setMarkerSearchHighlight(marker, nextHighlights.has(id));
      }
    });

    prevSearchHighlightSetRef.current = nextHighlights;
  }, [searchShopIds]);

  useEffect(() => {
    aiHighlightSetRef.current = new Set(aiHighlightShopIds ?? []);
    const nextHighlights = aiHighlightSetRef.current;
    const prevHighlights = prevAiHighlightSetRef.current;
    const changed = new Set<number>();

    prevHighlights.forEach((id) => {
      if (!nextHighlights.has(id)) changed.add(id);
    });
    nextHighlights.forEach((id) => {
      if (!prevHighlights.has(id)) changed.add(id);
    });

    changed.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        setMarkerHighlight(marker, id, nextHighlights.has(id));
      }
    });

    prevAiHighlightSetRef.current = nextHighlights;
  }, [aiHighlightShopIds]);

  useEffect(() => {
    commentHighlightSetRef.current = new Set(commentHighlightShopIds ?? []);
    const nextHighlights = commentHighlightSetRef.current;
    const prevHighlights = prevCommentHighlightSetRef.current;
    const changed = new Set<number>();

    prevHighlights.forEach((id) => {
      if (!nextHighlights.has(id)) changed.add(id);
    });
    nextHighlights.forEach((id) => {
      if (!prevHighlights.has(id)) changed.add(id);
    });

    changed.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        setMarkerCommentHighlight(marker, nextHighlights.has(id));
      }
    });

    prevCommentHighlightSetRef.current = nextHighlights;
  }, [commentHighlightShopIds]);

  useEffect(() => {
    bagShopSetRef.current = new Set(bagShopIds ?? []);
    const nextHighlights = bagShopSetRef.current;
    const prevHighlights = prevBagShopSetRef.current;
    const changed = new Set<number>();

    prevHighlights.forEach((id) => {
      if (!nextHighlights.has(id)) changed.add(id);
    });
    nextHighlights.forEach((id) => {
      if (!prevHighlights.has(id)) changed.add(id);
    });

    changed.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        setMarkerBag(marker, nextHighlights.has(id));
      }
    });

    prevBagShopSetRef.current = nextHighlights;
  }, [bagShopIds]);

  useEffect(() => {
    markersRef.current.forEach((marker, shopId) => {
      const icon = marker.getElement();
      if (icon) {
        if (shopId === selectedShopId) {
          icon.classList.add('shop-marker-selected');
          marker.setZIndexOffset(1000);
        } else {
          icon.classList.remove('shop-marker-selected');
          if (aiHighlightSetRef.current.has(shopId)) {
            marker.setZIndexOffset(900);
          } else {
            marker.setZIndexOffset(0);
          }
        }
      }
    });

    if (selectedShopId && clusterGroupRef.current) {
      const selectedMarker = markersRef.current.get(selectedShopId);
      if (selectedMarker) {
        clusterGroupRef.current.zoomToShowLayer(selectedMarker, () => {});
      }
    }
  }, [selectedShopId]);

  return null;
}

export default memo(OptimizedShopLayerWithClustering);
