import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-content-get",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dc = createAdminClient() ?? supabase;
  const { data, error } = await dc
    .from("vendor_contents")
    .select("id, vendor_id, title, body, image_url, expires_at, created_at, status, vendors(shop_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/content] select failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ contents: data });
}
