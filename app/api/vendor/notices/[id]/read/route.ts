import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorNotices } from "../../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: お知らせに「確認しました」を付ける。2回目以降は何もしない
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendorNotices(request, { permission: "inquiries" });
  if (!auth.ok) return auth.response;
  const { user, vendorId, db } = auth;

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

  const { error } = await db.from("vendor_notice_reads").insert({ notice_id: id, vendor_id: vendorId });
  // 23505: もう確認済み / 23503: 取り下げられたお知らせ
  if (error?.code === "23503") return NextResponse.json({ error: "このお知らせは取り下げられました" }, { status: 404 });
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "うまく記録できんかった。もういっぺん押してみてや。" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
