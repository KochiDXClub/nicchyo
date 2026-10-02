import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import {
  NOTICE_COLUMNS,
  NoticeInputSchema,
  rowToNotice,
  type NoticeRow,
} from "@/lib/vendor/notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 管理画面に並べる件数 */
const ADMIN_LIST_LIMIT = 50;

/**
 * GET: 出したお知らせと、それぞれを確認した出店者の数
 */
export async function GET(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  // vendor_notices は生成済み Database 型に未登録のため型は付けない（content_views と同じ）
  const db = auth.adminClient as unknown as SupabaseClient;

  const { data, error } = await db
    .from("vendor_notices")
    .select(NOTICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(ADMIN_LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const notices = ((data ?? []) as NoticeRow[]).map(rowToNotice);
  if (notices.length === 0) return NextResponse.json({ notices: [] });

  const counts = await db.rpc("get_vendor_notice_read_counts", { notice_ids: notices.map((n) => n.id) });
  if (counts.error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const readCounts = new Map(
    ((counts.data ?? []) as { notice_id: string; cnt: number }[]).map((row) => [row.notice_id, Number(row.cnt)])
  );

  return NextResponse.json({
    notices: notices.map((notice) => ({ ...notice, readCount: readCounts.get(notice.id) ?? 0 })),
  });
}

/**
 * POST: お知らせを全出店者へ出す
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { user, role, adminClient } = auth;
  const db = adminClient as unknown as SupabaseClient;

  const parsed = NoticeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }

  const { data, error } = await db
    .from("vendor_notices")
    .insert({ ...parsed.data, created_by: user.id })
    .select(NOTICE_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: "出せませんでした" }, { status: 500 });

  const notice = rowToNotice(data as NoticeRow);
  await logAdminAudit(
    adminClient,
    { id: user.id, email: user.email, role },
    {
      action: "vendor_notice_created",
      targetType: "vendor_notice",
      targetId: notice.id,
      targetName: notice.title,
      details: JSON.stringify({ sender: notice.sender, important: notice.important }),
    }
  );

  return NextResponse.json({ notice: { ...notice, readCount: 0 } });
}
