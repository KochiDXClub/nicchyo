import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
// 60秒キャッシュ — CDN・ISR 両対応
export const revalidate = 60;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ enabled: false, message: "" });
  }

  try {
    const dc = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data } = await dc
      .from("system_settings")
      .select("value")
      .eq("key", "public")
      .maybeSingle();

    const value = data?.value as Record<string, unknown> | null;
    const enabled = value?.maintenanceMode === true;
    const message =
      typeof value?.maintenanceMessage === "string" ? value.maintenanceMessage : "";

    return NextResponse.json({ enabled, message });
  } catch {
    return NextResponse.json({ enabled: false, message: "" });
  }
}
