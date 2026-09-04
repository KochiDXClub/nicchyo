import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeRequest, createAdminClient } from "../../_shared";
import { VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH, isUuid } from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

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

  // IP単位は認証前の連打を止める粗い上限。実際の投稿数制限は認証後に担当者単位でかける
  const floodLimited = await enforceRateLimit(req, {
    bucket: "admin-vendor-inquiry-replies-post-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const { user, error } = await authorizeRequest();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-vendor-inquiry-replies-post",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    keySuffix: user.id,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  // uuid型の列に非UUIDを渡すとPostgreSQLが22P02を返し500になるため、先に弾く
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
