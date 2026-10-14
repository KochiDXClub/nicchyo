import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import MapPageClient from './MapPageClient';
import MapLoadingOverlay from '../../components/MapLoadingOverlay';
import type { Shop } from './data/shops';
import { fetchPublicShops } from './services/shopCache';
import { fetchLandmarksFromDb } from './services/landmarksDb';
import type { Landmark } from './types/landmark';
import { withOptimizedLandmarkImage } from './utils/landmarkImages';
import type { MapRoute } from './types/mapRoute';
import { fetchMapRouteFromDb, getFallbackMapRoute } from './services/mapRouteDb';
import { safeJsonLd } from '@/lib/utils/jsonLd';
import { SUNDAY_MARKET_JSON_LD } from '@/lib/seo/sundayMarketJsonLd';
import { fetchMapFeatureFlags } from '@/lib/mapFeatureFlags.server';
import { fetchMapViewSettings } from '@/lib/map/mapViewSettings.server';

export const metadata: Metadata = {
  title: "日曜市マップ",
  description:
    "高知・日曜市をリアルタイムで探索。出店中のお店・場所・商品をインタラクティブ地図で確認できます。毎週日曜開催、追手筋一帯に約300店舗が並びます。",
  openGraph: {
    title: "日曜市マップ | nicchyo",
    description:
      "高知・日曜市をリアルタイムで探索。出店中のお店・場所・商品をインタラクティブ地図で確認できます。",
    images: [{ url: "/og-map.png", width: 1200, height: 630, alt: "高知日曜市マップ" }],
  },
};


export default async function MapPage() {
  const cookieStore = await cookies();
  // マップ動作フラグ（管理画面で切替可能。URL の ?mapFlags= はクライアント側で上書きする）と
  // マップの可動範囲（管理画面「マップの表示範囲」で設定する。MapLibre 版でのみ効く）は、
  // 店舗・建物・道の取得と独立しているので、先に開始して並列に待つ
  const featureFlagsPromise = fetchMapFeatureFlags();
  const mapViewSettingsPromise = fetchMapViewSettings();

  let shops: Shop[] = [];
  let landmarks: Landmark[] = [];
  let mapRoute: MapRoute = getFallbackMapRoute();

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

  if (hasSupabaseEnv) {
    try {
      const supabase = createClient(cookieStore);
      // 1つの取得が失敗しても他の取得結果を巻き込まないよう、allSettled で独立に扱う
      const [shopsResult, landmarksResult, mapRouteResult] = await Promise.allSettled([
        // 店舗は全員共通のキャッシュから読む（ログイン状態に関係なく同じ内容）
        fetchPublicShops(),
        fetchLandmarksFromDb(supabase),
        fetchMapRouteFromDb(supabase),
      ]);

      if (shopsResult.status === "fulfilled") {
        shops = shopsResult.value;
      } else {
        console.warn("[MapPage] 店舗データの取得に失敗しました:", shopsResult.reason);
      }

      if (landmarksResult.status === "fulfilled") {
        landmarks = landmarksResult.value.map(withOptimizedLandmarkImage);
      } else {
        console.warn("[MapPage] 建物データの取得に失敗しました:", landmarksResult.reason);
      }

      if (mapRouteResult.status === "fulfilled") {
        mapRoute = mapRouteResult.value;
      } else {
        console.warn("[MapPage] 道データの取得に失敗しました:", mapRouteResult.reason);
      }
    } catch (error) {
      // createClient 自体が同期的に例外を投げるケースも含め、ここで拾ってデフォルト値のまま続行する
      console.warn("[MapPage] マップデータの取得に失敗しました:", error);
    }
  }

  const [featureFlags, mapViewSettings] = await Promise.all([
    featureFlagsPromise,
    mapViewSettingsPromise,
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(SUNDAY_MARKET_JSON_LD) }}
      />
      {/* 地図チャンクの遅延読み込み中もローディング画面を切らさない */}
      <Suspense fallback={<MapLoadingOverlay minStage="page" />}>
        <MapPageClient
        shops={shops}
        landmarks={landmarks}
        mapRoute={mapRoute}
        featureFlags={featureFlags}
        mapViewSettings={mapViewSettings}
        />
      </Suspense>
    </>
  );
}
