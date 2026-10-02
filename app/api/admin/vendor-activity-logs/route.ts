import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { fetchActivityLogPage } from "@/lib/vendor/activityLogQuery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  vendorId: z.string().uuid(),
  before: z.string().datetime().optional(),
});

/**
 * GET: 店舗の操作ログ（運営向け・全店舗）。新しい順。?vendorId=<店舗ID>&before=<日時>
 * 出店者側（/api/vendor/activity-logs）と同じ中身を、運営は権限に関係なく読める。
 */
export async function GET(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const parsed = QuerySchema.safeParse({
    vendorId: params.get("vendorId") ?? undefined,
    before: params.get("before") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "店舗と日時の形を確かめてください" }, { status: 400 });

  // vendor_activity_logs は生成済み Database 型に未登録のため型は付けない
  const page = await fetchActivityLogPage(auth.adminClient as unknown as SupabaseClient, parsed.data.vendorId, parsed.data.before);
  if (!page) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  return NextResponse.json(page);
}
