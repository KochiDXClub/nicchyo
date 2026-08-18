import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import { isPatchableStatus } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// 一時的な非表示（hidden）⇔再表示（active）の切り替え。
// 完全削除（DELETE）とは別の軽量モデレーション手段として提供する。
// deleted への遷移はここでは扱わない（誤操作防止のため DELETE 経由に限定）。
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-content-id-patch",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const status = (body as { status?: unknown } | null)?.status;
  if (!isPatchableStatus(status)) {
    return NextResponse.json({ error: "status must be 'active' or 'hidden'" }, { status: 400 });
  }

  const dc = createAdminClient() ?? supabase;
  const { data, error } = await dc
    .from("vendor_contents")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) {
    console.error("[admin/content] patch failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, status: data.status });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-content-id-delete",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dc = createAdminClient() ?? supabase;
  const { error } = await dc.from("vendor_contents").delete().eq("id", id);

  if (error) {
    console.error("[admin/content] delete failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
