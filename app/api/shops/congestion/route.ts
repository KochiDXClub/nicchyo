import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { fetchVendorShopsFromDb } from "../../../(public)/map/services/shopDb";
import { estimateCongestion, type LocationLog } from "../../../../lib/analytics/congestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  try {
    const serviceClient = getServiceClient();

    // 1. Fetch current shops
    const shops = await fetchVendorShopsFromDb(serviceClient);

    // 2. Fetch recent location logs (last 30 minutes)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: logsData, error: logsError } = await serviceClient
      .from("user_location_logs")
      .select("visitor_key, latitude, longitude, speed, created_at")
      .gt("created_at", thirtyMinsAgo);

    if (logsError) {
      console.error("[congestion-api] logs fetch error:", logsError);
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
    }

    const logs = (logsData || []) as LocationLog[];

    // 3. Estimate congestion
    const shopCoordinates = shops.map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
    }));

    const congestionData = estimateCongestion(shopCoordinates, logs);

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        congestion: congestionData
    });
  } catch (err) {
    console.error("[congestion-api] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
