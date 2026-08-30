import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH } from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

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

const ReplyBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "本文を入力してください")
    .max(VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH, `本文は${VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH}文字以内で入力してください`),
  // city ロールが未整備の間は、運営が市役所の代理として city 名義で送ることも許可する
  // （supabase/migrations/20260830100000_create_vendor_inquiries.sql の設計コメント参照）
  sender_role: z.enum(["operator", "city"]).optional(),
});

// ─── POST: 運営(市役所代理含む)がスレッドに返信する ────────────────
export async function POST(req: Request, { params }: RouteParams) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-vendor-inquiry-replies-post",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeRequest();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = ReplyBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data: inquiry, error: fetchErr } = await dc
    .from("vendor_inquiries")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    console.error("[admin/vendor-inquiries/:id/replies] fetch error:", fetchErr.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error: insertErr } = await dc
    .from("vendor_inquiry_replies")
    .insert({
      inquiry_id: id,
      sender_role: parsed.data.sender_role ?? "operator",
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (insertErr) {
    console.error("[admin/vendor-inquiries/:id/replies] insert error:", insertErr.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ reply: data }, { status: 201 });
}
