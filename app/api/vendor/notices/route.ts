import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireVendorRole } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { NOTICE_COLUMNS, NOTICE_LIST_LIMIT, rowToNotice, type NoticeRow } from "@/lib/vendor/notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: 運営・市役所からのお知らせと、自分が「確認しました」を押したかどうか
 */
export async function GET(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requireVendorRole(user);
  if (forbidden) return forbidden;

  // vendor_notices は service_role でしか読めない（生成済み Database 型にも未登録）
  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("vendor_notices")
    .select(NOTICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(NOTICE_LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const notices = ((data ?? []) as NoticeRow[]).map(rowToNotice);
  if (notices.length === 0) return NextResponse.json({ notices: [] });

  // 自分の確認だけを読む（ほかの出店者が確認したかどうかは返さない）
  const reads = await db
    .from("vendor_notice_reads")
    .select("notice_id")
    .eq("vendor_id", user.id)
    .in("notice_id", notices.map((n) => n.id));
  if (reads.error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const confirmed = new Set((reads.data ?? []).map((row) => row.notice_id as string));

  return NextResponse.json({
    notices: notices.map((notice) => ({ ...notice, confirmed: confirmed.has(notice.id) })),
  });
}
