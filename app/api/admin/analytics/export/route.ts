import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { addDaysToDateString, todayJstString } from "@/lib/time/jstDate";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { toCsv } from "@/lib/utils/csv";
import { aggregateExportRows, readAllExportRows } from "@/lib/analytics/exportRows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = {
  page_analytics: { table: "web_page_analytics", date: "visit_date", columns: ["visit_date", "visitor_key", "path", "duration_seconds", "user_role"], dimension: "path", dateOnly: true },
  shop_views: { table: "shop_page_views", date: "viewed_at", columns: ["viewed_at", "vendor_id", "source"], dimension: "source", dateOnly: false },
  search_logs: { table: "product_search_logs", date: "searched_at", columns: ["searched_at", "keyword", "result_count"], dimension: undefined, dateOnly: false },
  consult_logs: { table: "ai_consult_logs", date: "consulted_at", columns: ["consulted_at", "intent_category", "location_type", "is_recommendation", "store_id"], dimension: "intent_category", dateOnly: false },
  guide_events: { table: "guide_events", date: "created_at", columns: ["created_at", "event_type", "kinds", "spot_key", "origin_type", "walk_minutes", "distance_meters"], dimension: "event_type", dateOnly: false },
} as const;
type ExportType = keyof typeof TYPES;

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const params = req.nextUrl.searchParams;
  const type = params.get("type") ?? "page_analytics";
  const mode = params.get("mode") ?? "summary";
  const days = Number(params.get("days") ?? "30");
  if (!Object.hasOwn(TYPES, type) || !["summary", "raw"].includes(mode) || !Number.isInteger(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "出力条件が不正です" }, { status: 400 });
  }
  const spec = TYPES[type as ExportType];
  const today = todayJstString();
  const since = addDaysToDateString(today, 1 - days);
  const until = addDaysToDateString(today, 1);
  const lower = spec.dateOnly ? since : new Date(`${since}T00:00:00+09:00`).toISOString();
  const upper = spec.dateOnly ? until : new Date(`${until}T00:00:00+09:00`).toISOString();
  try {
    const rows = await readAllExportRows<Record<string, unknown>>(async (from, to) => {
      const result = await auth.adminClient.from(spec.table).select([...spec.columns, "id"].join(","))
        .gte(spec.date, lower).lt(spec.date, upper).order(spec.date, { ascending: false }).order("id", { ascending: false }).range(from, to);
      return { data: result.data as unknown as Record<string, unknown>[] | null, error: result.error };
    });
    const output = mode === "raw" ? rows : aggregateExportRows(rows, spec.date, spec.dimension);
    const columns = mode === "raw" ? [...spec.columns] : ["date", "category", "count"];
    await logAdminAudit(auth.adminClient, { id: auth.user.id, email: auth.user.email, role: auth.role }, { action: "analytics_export", targetType: "analytics", details: JSON.stringify({ type, mode, since, until: today, rows: output.length }) });
    return new NextResponse(toCsv(output, columns), { headers: { ...privateNoStoreHeaders(), "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}_${mode}_${since}_to_${today}.csv"` } });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("上限") ? error.message : "データ取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500, headers: privateNoStoreHeaders() });
  }
}
