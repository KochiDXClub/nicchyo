import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorRole } from "@/lib/auth/permissions";
import { VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH } from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const ReplyBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "本文を入力してください")
    .max(VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH, `本文は${VENDOR_INQUIRY_REPLY_BODY_MAX_LENGTH}文字以内で入力してください`),
});

// ─── POST: 自分のスレッドに返信する ────────────────────────────
export async function POST(request: Request, { params }: RouteParams) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiry-replies-post",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const parsed = ReplyBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vendor_inquiry_replies")
    .insert({
      inquiry_id: id,
      sender_role: "vendor",
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) {
    // RLS違反（他人のスレッドへの返信を試みた等）は 42501 (insufficient_privilege)
    if (error.code === "42501") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[vendor/inquiries/:id/replies] insert error:", error.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ reply: data }, { status: 201 });
}
