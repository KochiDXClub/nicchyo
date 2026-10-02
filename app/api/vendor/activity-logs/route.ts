import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchActivityLogPage } from "@/lib/vendor/activityLogQuery.server";
import { requireMembersApi } from "../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ before: z.string().datetime().optional() });

/**
 * GET: 自分の店舗の操作ログ（代表者と、操作ログの閲覧の権限があるメンバーだけ）。新しい順。
 * ?before=<日時> でそれより古い分を続けて読む。
 */
export async function GET(request: Request) {
  const auth = await requireMembersApi(request, { permission: "audit_view" });
  if (!auth.ok) return auth.response;
  const { db, vendorId } = auth;

  const parsed = QuerySchema.safeParse({ before: new URL(request.url).searchParams.get("before") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "日時の形が正しくありません" }, { status: 400 });

  const page = await fetchActivityLogPage(db, vendorId, parsed.data.before);
  if (!page) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  return NextResponse.json(page);
}
