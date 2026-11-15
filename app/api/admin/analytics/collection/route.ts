import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { ANALYTICS_COLLECTION_ITEMS, type AnalyticsCollectionSettings } from "@/lib/analytics/collectionSettings";
import { ANALYTICS_SETTINGS_KEY, readAnalyticsCollectionSettings, revalidateAnalyticsCollectionSettings } from "@/lib/analytics/collectionSettings.server";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json({ settings: await readAnalyticsCollectionSettings() }, { headers: privateNoStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "設定を読み込めませんでした" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const origin = requireSameOrigin(request);
  if (!origin.ok) return origin.response;
  const rateLimited = await enforceRateLimit(request, { bucket: "analytics-collection-settings", limit: 20, windowMs: 600000 });
  if (rateLimited) return rateLimited;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const value = await request.json().catch(() => null);
  const keys = ANALYTICS_COLLECTION_ITEMS.map(({ key }) => key);
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => typeof value[key] !== "boolean")) {
    return NextResponse.json({ error: "設定が不正です" }, { status: 400 });
  }
  // Google アナリティクスの停止は未実装のため、保存値に関係なく取得のままにする。
  const settings = { ...(value as AnalyticsCollectionSettings), googleAnalytics: true };
  const { error } = await auth.adminClient.from("system_settings").upsert({ key: ANALYTICS_SETTINGS_KEY, value: settings, updated_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "設定を保存できませんでした" }, { status: 500 });
  revalidateAnalyticsCollectionSettings();
  await logAdminAudit(auth.adminClient, { id: auth.user.id, email: auth.user.email, role: auth.role }, { action: "analytics_collection_updated", targetType: "analytics_settings", details: JSON.stringify(settings) });
  return NextResponse.json({ settings }, { headers: privateNoStoreHeaders() });
}
