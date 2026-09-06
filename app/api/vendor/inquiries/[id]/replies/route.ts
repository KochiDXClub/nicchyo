import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorRole } from "@/lib/auth/permissions";
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
});

// ─── POST: 自分のスレッドに返信する ────────────────────────────
export async function POST(request: Request, { params }: RouteParams) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // IP単位は認証前の連打を止める粗い上限。実際の投稿数制限は認証後に出店者単位でかける
  // （日曜市の会場Wi-Fi等で複数の出店者が同一IPになりうるため）
  const floodLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiry-replies-post-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const { id } = await params;
  // uuid型の列に非UUIDを渡すとPostgreSQLが22P02を返し500になるため、先に弾く。
  // 存在しないIDと同じ404にして、IDの存在有無が漏れないようにする
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiry-replies-post",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    keySuffix: user.id,
  });
  if (rateLimited) return rateLimited;

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
    // 42501: RLS違反（他人のスレッドへの返信） / 23503: FK違反（存在しないスレッド）
    // どちらも404に潰し、スレッドの存在有無が漏れないようにする。
    // 同ディレクトリの [id]/route.ts の GET も両方404に揃えている
    if (error.code === "42501" || error.code === "23503") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[vendor/inquiries/:id/replies] insert error:", error.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ reply: data }, { status: 201 });
}
