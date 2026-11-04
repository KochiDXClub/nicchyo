import { inquiryImagePath } from "@/lib/vendorInquiries/imageStorage";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClientWithExtensions } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import {
  VENDOR_INQUIRY_TOPICS,
  VENDOR_INQUIRY_CATEGORIES,
  VENDOR_INQUIRY_URGENCIES,
  VENDOR_INQUIRY_BODY_MAX_LENGTH,
  VENDOR_INQUIRY_IMAGE_URL_MAX_LENGTH,
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
    .max(
      VENDOR_INQUIRY_IMAGE_URL_MAX_LENGTH,
      `画像URLは${VENDOR_INQUIRY_IMAGE_URL_MAX_LENGTH}文字以内にしてください`
    )
    // 公開URL・外部URL・署名URLは保存しない。店舗との対応は認証後に検証する。
    .refine((v) => inquiryImagePath(v) !== null, { message: "許可されていない画像です" })
    .optional(),
});

// ─── GET: 自分のスレッド一覧 ───────────────────────────────────
export async function GET(request: Request) {
  // GETは状態を変えないが、管理側の一覧GETと防御レベルを揃えておく
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireVendorContext({ permission: "inquiries" });
  if (!auth.ok) return auth.response;
  const { vendorId } = auth;
  // vendor_inquiries は生成済み型に無いので、拡張型のクライアントで読み書きする（認証は上で済み）
  const supabase = createClientWithExtensions(await cookies());

  const { data, error } = await supabase
    .from("vendor_inquiries")
    .select("*")
    .eq("vendor_id", vendorId)
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
  // 実際の投稿数の制限は認証後に出店者単位（identity: user.id）でかける。
  const floodLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiries-post-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const auth = await requireVendorContext({ permission: "inquiries" });
  if (!auth.ok) return auth.response;
  const { user, vendorId } = auth;
  // vendor_inquiries は生成済み型に無いので、拡張型のクライアントで読み書きする（認証は上で済み）
  const supabase = createClientWithExtensions(await cookies());

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-inquiries-post",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (rateLimited) return rateLimited;

  const parsed = CreateInquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { topic, category, urgency, body, image_url } = parsed.data;
  if (image_url && !inquiryImagePath(image_url, vendorId)) {
    return NextResponse.json({ error: "この店舗の添付画像ではありません" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("vendor_inquiries")
    .insert({
      vendor_id: vendorId,
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
