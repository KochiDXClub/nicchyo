import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";
// 60秒キャッシュ — CDN・ISR 両対応
export const revalidate = 60;

export async function GET() {
  try {
    const dc = createAdminClient();
    if (!dc) {
      return NextResponse.json({ enabled: false, message: "" });
    }

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
