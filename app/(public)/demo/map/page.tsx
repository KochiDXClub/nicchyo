import { Metadata } from "next";
import { Suspense } from "react";
import MapPageClient from "../../map/MapPageClient";
import MapLoadingOverlay from "../../../components/MapLoadingOverlay";
import { getFallbackMapRoute } from "../../map/services/mapRouteDb";
import { DEFAULT_MAP_FEATURE_FLAGS } from "@/lib/mapFeatureFlags";
import { DEFAULT_MAP_VIEW_SETTINGS } from "@/lib/map/mapViewSettings";
import { buildDemoShops, DEMO_LANDMARKS } from "./demoMapData";

export const metadata: Metadata = {
  title: "マップ（デモ）",
  description: "架空の店舗データで動く日曜市マップのデモです。",
  robots: { index: false },
};

/**
 * 本番マップ（/map）が準備中のあいだ、誰でも見られる見本の地図。
 * DB には触れず、架空の店舗と既定の道だけで描く。
 */
export default function DemoMapPage() {
  return (
    <Suspense fallback={<MapLoadingOverlay minStage="page" />}>
      <MapPageClient
        shops={buildDemoShops()}
        landmarks={DEMO_LANDMARKS}
        mapRoute={getFallbackMapRoute()}
        featureFlags={DEFAULT_MAP_FEATURE_FLAGS}
        mapViewSettings={DEFAULT_MAP_VIEW_SETTINGS}
      />
    </Suspense>
  );
}
