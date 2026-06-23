import { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import MapPageClient from './MapPageClient';
import type { Shop } from './data/shops';
import { fetchMapData, type AttendanceEstimate } from './fetch-map-data';
import { fetchVendorShopsFromDb } from './services/shopDb';
import { fetchLandmarksFromDb } from './services/landmarksDb';
import type { Landmark } from './types/landmark';
import type { MapRoute } from './types/mapRoute';
import { fetchMapRouteFromDb, getFallbackMapRoute } from './services/mapRouteDb';

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
  let attendanceEstimates: Record<number, AttendanceEstimate> = {};

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (hasSupabaseEnv) {
    try {
      const supabase = createClient(cookieStore);
      const [fetchedShops, fetchedLandmarks, fetchedMapRoute, mapData] = await Promise.all([
        fetchVendorShopsFromDb(supabase),
        fetchLandmarksFromDb(supabase),
        fetchMapRouteFromDb(supabase),
        fetchMapData(supabase),
      ]);
      shops = fetchedShops;
      landmarks = fetchedLandmarks;
      mapRoute = fetchedMapRoute;
      attendanceEstimates = mapData.attendanceEstimates;
    } catch (error) {
      console.error("[MapPage] マップデータの取得に失敗しました:", error);
      shops = [];
      landmarks = [];
      mapRoute = getFallbackMapRoute();
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sundayMarketJsonLd) }}
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
          attendanceEstimates={attendanceEstimates}
        />
      </Suspense>
    </>
  );
}
