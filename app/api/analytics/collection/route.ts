import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { NextResponse } from "next/server";
import { isAnalyticsCollectionEnabled } from "@/lib/analytics/collectionSettings.server";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ googleAnalytics: await isAnalyticsCollectionEnabled("googleAnalytics") }, { headers: privateNoStoreHeaders() });
}
