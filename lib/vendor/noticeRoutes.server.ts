/**
 * 出店者へのお知らせ（vendor_notices）の API の本体。
 * 運営（/api/admin/vendor-notices）と高知市（/api/city/vendor-notices）が同じ検証・同じ操作ログで動くよう、
 * ここに置く。違いは認可と、差出人だけ。
 *
 * 高知市は差出人を「高知市から」に固定し（本文で別の値を送っても無視する）、
 * 高知市名義のお知らせだけを見て・取り下げられる（運営名義のお知らせは触れない）。
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdminApi, type AdminApiContext } from "@/lib/auth/requireAdminApi";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { NOTICE_COLUMNS, NoticeInputSchema, rowToNotice, type NoticeRow } from "@/lib/vendor/notices";

export type NoticeScope = "admin" | "city";

/** 管理画面に並べる件数 */
const LIST_LIMIT = 50;

const SCOPES: Record<NoticeScope, { authorize: () => Promise<AdminApiContext | { error: NextResponse }>; bucket: string }> = {
  admin: { authorize: requireAdminApi, bucket: "admin-vendor-notice" },
  city: { authorize: requireCityApi, bucket: "city-vendor-notice" },
};

/** 入口と書き込みの前に通す共通の確認：同一オリジン → 認可 →（書き込みなら）回数の上限 */
async function enter(
  request: Request,
  scope: NoticeScope,
  write: boolean,
): Promise<{ error: Response } | { auth: AdminApiContext }> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { error: originCheck.response };
  const auth = await SCOPES[scope].authorize();
  if ("error" in auth) return { error: auth.error };
  if (write) {
    const limited = await enforceRateLimit(request, {
      bucket: SCOPES[scope].bucket,
      limit: 60,
      windowMs: 10 * 60 * 1000,
      identity: auth.user.id,
    });
    if (limited) return { error: limited };
  }
  return { auth };
}

/** 高知市の入口で入った担当者（admin 以外）は、高知市名義のものだけを扱う */
function citySenderOnly(scope: NoticeScope, role: string | null): boolean {
  return scope === "city" && role !== "admin";
}

/** 出したお知らせと、それぞれを確認した出店者の数 */
export async function listNotices(request: Request, scope: NoticeScope) {
  const entered = await enter(request, scope, false);
  if ("error" in entered) return entered.error;
  const { auth } = entered;
  // vendor_notices は生成済み Database 型に未登録のため型は付けない（content_views と同じ）
  const db = auth.adminClient as unknown as SupabaseClient;

  let query = db.from("vendor_notices").select(NOTICE_COLUMNS);
  if (citySenderOnly(scope, auth.role)) query = query.eq("sender", "city");
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const notices = ((data ?? []) as NoticeRow[]).map(rowToNotice);
  if (notices.length === 0) return NextResponse.json({ notices: [] });

  const counts = await db.rpc("get_vendor_notice_read_counts", { notice_ids: notices.map((n) => n.id) });
  if (counts.error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const readCounts = new Map(
    ((counts.data ?? []) as { notice_id: string; cnt: number }[]).map((row) => [row.notice_id, Number(row.cnt)]),
  );

  return NextResponse.json({
    notices: notices.map((notice) => ({ ...notice, readCount: readCounts.get(notice.id) ?? 0 })),
  });
}

/** お知らせを全出店者へ出す */
export async function createNotice(request: Request, scope: NoticeScope) {
  const entered = await enter(request, scope, true);
  if ("error" in entered) return entered.error;
  const { user, role, adminClient } = entered.auth;
  const db = adminClient as unknown as SupabaseClient;

  const parsed = NoticeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }
  // 高知市の担当者は、差出人を選べない（「運営から」を名乗れない）
  const input = citySenderOnly(scope, role) ? { ...parsed.data, sender: "city" as const } : parsed.data;

  const { data, error } = await db
    .from("vendor_notices")
    .insert({ ...input, created_by: user.id })
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
    },
  );

  return NextResponse.json({ notice: { ...notice, readCount: 0 } });
}

/**
 * お知らせを取り下げる（出店者の「確認しました」も一緒に消える）。
 * 書き直しは用意しない。確認済みの出店者がいる内容を黙って変えないよう、取り下げて出し直す。
 */
export async function deleteNotice(request: Request, params: Promise<{ id: string }>, scope: NoticeScope) {
  const entered = await enter(request, scope, true);
  if ("error" in entered) return entered.error;
  const { user, role, adminClient } = entered.auth;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  }

  const db = adminClient as unknown as SupabaseClient;
  let query = db.from("vendor_notices").delete().eq("id", id);
  if (citySenderOnly(scope, role)) query = query.eq("sender", "city");
  const { data, error } = await query.select("sender, title, body, important").maybeSingle();
  if (error) return NextResponse.json({ error: "取り下げられませんでした" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const removed = data as { sender: string; title: string; body: string; important: boolean };

  await logAdminAudit(
    adminClient,
    { id: user.id, email: user.email, role },
    {
      action: "vendor_notice_deleted",
      targetType: "vendor_notice",
      targetId: id,
      targetName: removed.title,
      // 取り下げると行が消えるので、何を出していたかを残す
      details: JSON.stringify({ sender: removed.sender, important: removed.important, body: removed.body }),
    },
  );

  return NextResponse.json({ ok: true });
}
