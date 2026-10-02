import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { isVendorTourKey } from "@/lib/vendor/tours";
import { requireVendor } from "../ai-notes/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SeenSchema = z.object({ key: z.string().refine(isVendorTourKey) });

/**
 * GET: 自分が「了解した」で閉じた説明パネルの名前の一覧。
 * vendor_tour_seen は RLS で本人の行だけに絞られているので、service_role は使わない。
 */
export async function GET() {
  const auth = await requireVendor();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase.from("vendor_tour_seen").select("tour_key").eq("vendor_id", user.id);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  return NextResponse.json({ seen: (data ?? []).map((row) => row.tour_key) });
}

/**
 * POST: 説明パネルを「了解した」で閉じたと記録する。すでに記録があっても成功にする。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireVendor();
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "vendor-tour-seen",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (rateLimited) return rateLimited;

  const parsed = SeenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "画面の名前を読み取れませんでした" }, { status: 400 });

  // 更新はさせない（RLS も insert だけ許す）。すでにあれば何もしない
  const { error } = await supabase
    .from("vendor_tour_seen")
    .upsert({ vendor_id: user.id, tour_key: parsed.data.key }, { onConflict: "vendor_id,tour_key", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
