import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import {
  isUuid,
  isVendorInquiryCategory,
  isVendorInquiryStatus,
  isVendorInquiryTopic,
  isVendorInquiryUrgency,
} from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient<DatabaseWithExtensions>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authorizeRequest() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

// ─── GET: 一覧取得（宛先・緊急度・topic・status・出店者でフィルタ可） ─────
export async function GET(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { error } = await authorizeRequest();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const topic = searchParams.get("topic");
  const urgency = searchParams.get("urgency");
  const status = searchParams.get("status");
  const vendorId = searchParams.get("vendor_id");
  // ?limit=-5 のような負値・非数値でPostgRESTがエラーにならないよう 1〜MAX_LIMIT に丸める
  const limit = Math.min(
    Math.max(1, Math.floor(Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
    MAX_LIMIT
  );

  let query = dc.from("vendor_inquiries").select("*").order("created_at", { ascending: false }).limit(limit);

  if (category && isVendorInquiryCategory(category)) {
    query = query.eq("category", category);
  }
  if (topic && isVendorInquiryTopic(topic)) {
    query = query.eq("topic", topic);
  }
  if (urgency && isVendorInquiryUrgency(urgency)) {
    query = query.eq("urgency", urgency);
  }
  if (status && isVendorInquiryStatus(status)) {
    query = query.eq("status", status);
  }
  if (vendorId && isUuid(vendorId)) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    console.error("[admin/vendor-inquiries] fetch error:", dbError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiries: data });
}
