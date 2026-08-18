import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import MapPageClient from './MapPageClient';
import type { Shop } from './data/shops';
import { fetchVendorShopsFromDb } from './services/shopDb';
import { fetchLandmarksFromDb } from './services/landmarksDb';
import type { Landmark } from './types/landmark';
import type { MapRoute } from './types/mapRoute';
import { fetchMapRouteFromDb, getFallbackMapRoute } from './services/mapRouteDb';
import { safeJsonLd } from '@/lib/utils/jsonLd';

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

const sundayMarketJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "高知日曜市",
  description:
    "高知市追手筋で毎週日曜日に開催される大規模な路上市場。約300店舗が農産物・工芸品・骨董など多彩な品を並べます。",
  eventSchedule: {
    "@type": "Schedule",
    byDay: "https://schema.org/Sunday",
  },
  location: {
    "@type": "Place",
    name: "追手筋（高知城前〜追手筋東端）",
    address: {
      "@type": "PostalAddress",
      streetAddress: "追手筋",
      addressLocality: "高知市",
      addressRegion: "高知県",
      addressCountry: "JP",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "nicchyo（ニッチョ）",
    url: "https://nicchyo.jp",
  },
};

export default async function MapPage() {
  const cookieStore = await cookies();
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
        fetchVendorShopsFromDb(supabase),
        fetchLandmarksFromDb(supabase),
        fetchMapRouteFromDb(supabase),
      ]);

      if (shopsResult.status === "fulfilled") {
        shops = shopsResult.value;
      } else {
        console.warn("[MapPage] 店舗データの取得に失敗しました:", shopsResult.reason);
      }

      if (landmarksResult.status === "fulfilled") {
        landmarks = landmarksResult.value;
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(sundayMarketJsonLd) }}
      />
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">Loading...</div>
        }
      >
        <MapPageClient
        shops={shops}
        landmarks={landmarks}
        mapRoute={mapRoute}
        />
      </Suspense>
    </>
  );
}
