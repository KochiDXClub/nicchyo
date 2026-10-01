import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireVendorRole } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: お知らせに「確認しました」を付ける。2回目以降は何もしない
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-notices-read",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { error } = await db.from("vendor_notice_reads").insert({ notice_id: id, vendor_id: user.id });
  // 23505: もう確認済み / 23503: 取り下げられたお知らせ
  if (error?.code === "23503") return NextResponse.json({ error: "このお知らせは取り下げられました" }, { status: 404 });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "うまく記録できんかった。もういっぺん押してみてや。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
