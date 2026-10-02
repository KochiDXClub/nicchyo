import { NextResponse } from "next/server";
import { z } from "zod";
import { VENDOR_ACTIVITY_LABELS } from "@/lib/vendor/activityLog";
import { requireMembersApi } from "../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
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

  let query = db
    .from("vendor_activity_logs")
    .select("id, actor_name, action, summary, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (parsed.data.before) query = query.lt("created_at", parsed.data.before);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const rows = data ?? [];
  const page = rows.slice(0, PAGE_SIZE).map((row) => ({
    id: row.id as number,
    actorName: (row.actor_name as string | null) ?? "（退会したメンバー）",
    action: row.action as string,
    label: (VENDOR_ACTIVITY_LABELS as Record<string, string>)[row.action as string] ?? (row.action as string),
    summary: row.summary as string,
    createdAt: row.created_at as string,
  }));
  return NextResponse.json({ logs: page, hasMore: rows.length > PAGE_SIZE });
}
