import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { authorizeRequest, createAdminClient } from "./_shared";
import {
  isUuid,
  isVendorInquiryCategory,
  isVendorInquiryStatus,
  isVendorInquiryTopic,
  isVendorInquiryUrgency,
} from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

// ─── GET: 一覧取得（宛先・緊急度・topic・status・出店者でフィルタ可） ─────
export async function GET(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { error } = await authorizeRequest();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const topic = searchParams.get("topic");
  const urgency = searchParams.get("urgency");
  const status = searchParams.get("status");
  const vendorId = searchParams.get("vendor_id");
  // ?limit=-5 のような負値・非数値でPostgRESTがエラーにならないよう 1〜MAX_LIMIT に丸める
  const limit = Math.min(
    Math.max(1, Math.floor(Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
    MAX_LIMIT
  );

  let query = dc.from("vendor_inquiries").select("*").order("created_at", { ascending: false }).limit(limit);

  // フィルタは fail-closed にする。不正な値を黙って無視すると、絞り込んだつもりで
  // 全出店者のスレッドが返る（運営の受信箱としては危険）。UI側のtypoや、将来
  // status の値を変えたときにも静かに全件表示へ化けず、400で気づけるようにする
  const invalidFilter = (name: string) =>
    NextResponse.json({ error: `無効な ${name} です` }, { status: 400 });

  if (category !== null) {
    if (!isVendorInquiryCategory(category)) return invalidFilter("category");
    query = query.eq("category", category);
  }
  if (topic !== null) {
    if (!isVendorInquiryTopic(topic)) return invalidFilter("topic");
    query = query.eq("topic", topic);
  }
  if (urgency !== null) {
    if (!isVendorInquiryUrgency(urgency)) return invalidFilter("urgency");
    query = query.eq("urgency", urgency);
  }
  if (status !== null) {
    if (!isVendorInquiryStatus(status)) return invalidFilter("status");
    query = query.eq("status", status);
  }
  if (vendorId !== null) {
    if (!isUuid(vendorId)) return invalidFilter("vendor_id");
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    console.error("[admin/vendor-inquiries] fetch error:", dbError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiries: data });
}
