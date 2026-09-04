import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorRole } from "@/lib/auth/permissions";
import {
  VENDOR_INQUIRY_TOPICS,
  VENDOR_INQUIRY_CATEGORIES,
  VENDOR_INQUIRY_URGENCIES,
  VENDOR_INQUIRY_BODY_MAX_LENGTH,
  isAllowedVendorInquiryImageUrl,
} from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateInquirySchema = z.object({
  topic: z.enum(VENDOR_INQUIRY_TOPICS),
  category: z.enum(VENDOR_INQUIRY_CATEGORIES),
  urgency: z.enum(VENDOR_INQUIRY_URGENCIES).optional(),
  body: z
    .string()
    .trim()
    .min(1, "本文を入力してください")
    .max(VENDOR_INQUIRY_BODY_MAX_LENGTH, `本文は${VENDOR_INQUIRY_BODY_MAX_LENGTH}文字以内で入力してください`),
  image_url: z
    .string()
    .trim()
    .refine(isAllowedVendorInquiryImageUrl, { message: "許可されていない画像URLです" })
    .optional(),
});

// ─── GET: 自分のスレッド一覧 ───────────────────────────────────
export async function GET(request: Request) {
  // GETは状態を変えないが、管理側の一覧GETと防御レベルを揃えておく
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const { data, error } = await supabase
    .from("vendor_inquiries")
    .select("*")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[vendor/inquiries] fetch error:", error.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiries: data });
}

// ─── POST: スレッド作成 ────────────────────────────────────────
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // IP単位は「認証前の連打」を止めるための粗い上限にとどめる。
  // 日曜市の会場Wi-FiやキャリアグレードNATで複数の出店者が同一IPになりうるため、
  // 実際の投稿数の制限は認証後に出店者単位（keySuffix: user.id）でかける。
  const floodLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiries-post-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const cookieStore = await cookies();
  const supabase = createClientWithExtensions(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiries-post",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keySuffix: user.id,
  });
  if (rateLimited) return rateLimited;

  const parsed = CreateInquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { topic, category, urgency, body, image_url } = parsed.data;

  const { data, error } = await supabase
    .from("vendor_inquiries")
    .insert({
      vendor_id: user.id,
      topic,
      category,
      urgency: urgency ?? "normal",
      body,
      image_url: image_url ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[vendor/inquiries] insert error:", error.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiry: data }, { status: 201 });
}
