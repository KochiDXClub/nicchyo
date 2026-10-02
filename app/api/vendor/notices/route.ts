import { NextResponse } from "next/server";
import { NOTICE_COLUMNS, NOTICE_LIST_LIMIT, rowToNotice, type NoticeRow } from "@/lib/vendor/notices";
import { requireVendorNotices } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: 運営・市役所からのお知らせと、自分が「確認しました」を押したかどうか
 */
export async function GET(request: Request) {
  const auth = await requireVendorNotices(request);
  if (!auth.ok) return auth.response;
  const { user, vendorId, db } = auth;

  const { data, error } = await db
    .from("vendor_notices")
    .select(NOTICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(NOTICE_LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const notices = ((data ?? []) as NoticeRow[]).map(rowToNotice);
  // 出店者ページの帯で、登録より前のお知らせまで「未確認」として出さないために使う
  const joinedAt = user.created_at;
  if (notices.length === 0) return NextResponse.json({ notices: [], joinedAt });

  // 自分の店舗の確認だけを読む（ほかの店舗が確認したかどうかは返さない）
  const reads = await db
    .from("vendor_notice_reads")
    .select("notice_id")
    .eq("vendor_id", vendorId)
    .in("notice_id", notices.map((n) => n.id));
  if (reads.error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const confirmed = new Set((reads.data ?? []).map((row) => row.notice_id as string));

  return NextResponse.json({
    notices: notices.map((notice) => ({ ...notice, confirmed: confirmed.has(notice.id) })),
    joinedAt,
  });
}
