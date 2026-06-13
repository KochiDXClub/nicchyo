import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isModerator } from "@/lib/auth/permissions";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient<DatabaseWithExtensions>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// 通知一覧取得
export async function GET(_req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isModerator(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { data, error } = await dc
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/notifications] select failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ notifications: data });
}

// 全通知を既読にする
export async function PATCH(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-notifications-patch",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isModerator(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const { error } = await dc
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  if (error) {
    console.error("[admin/notifications] update failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
