import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import { SEASON_ID_BY_KEY, SEASON_OPTIONS } from "@/lib/vendor/askQuestions";

// 商品ごとの旬（product_seasons）を保存する。
// product_seasons には出店者が直接書く RLS のポリシーが無いので、ここで店舗の権限と
// 「その商品が自店のものか」を確かめてから、サービスロールで書く。
// 他店の商品には旬を付けられない（products.vendor_id で絞る）。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEASON_KEYS = SEASON_OPTIONS.map((option) => option.key) as [string, ...string[]];
const ProductSeasonsBodySchema = z.object({
  productId: z.string().uuid("productId が正しくありません"),
  seasons: z
    .array(z.enum(SEASON_KEYS))
    .max(SEASON_KEYS.length)
    .refine((list) => new Set(list).size === list.length, "同じ旬を重ねて選べません"),
});

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const auth = await requireVendorContext({ permission: "store_edit" });
    if (!auth.ok) return auth.response;
    const { vendorId } = auth;

    const parsed = ProductSeasonsBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { productId, seasons } = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "旬を保存できませんでした。" }, { status: 500 });
    }
    const admin = createServiceClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // 自店の商品かどうかを先に確かめる（他店の商品なら 404 として扱う）
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (productError) throw productError;
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const { error: deleteError } = await admin.from("product_seasons").delete().eq("product_id", productId);
    if (deleteError) throw deleteError;
    if (seasons.length > 0) {
      const { error: insertError } = await admin.from("product_seasons").insert(
        seasons.map((season) => ({
          product_id: productId,
          season_id: SEASON_ID_BY_KEY[season as keyof typeof SEASON_ID_BY_KEY],
        }))
      );
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true, seasons });
  } catch {
    return NextResponse.json({ error: "旬を保存できませんでした。" }, { status: 500 });
  }
}
