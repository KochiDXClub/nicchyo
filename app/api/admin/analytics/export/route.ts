import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportType = "page_analytics" | "shop_views" | "search_logs" | "consult_logs";

const COLUMNS: Record<ExportType, string[]> = {
  page_analytics: ["visit_date", "visitor_key", "path", "duration_seconds", "user_role"],
  shop_views: ["created_at", "vendor_id", "source", "event_type", "visitor_key"],
  search_logs: ["searched_at", "keyword"],
  consult_logs: ["consulted_at", "intent_category"],
};

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    // CSVインジェクション防止
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const csvLines = [
    columns.map(escape).join(","),
    ...rows.map((row) => columns.map((h) => escape(row[h])).join(",")),
  ];
  // BOM付きUTF-8でExcelが正しく開けるようにする
  return "﻿" + csvLines.join("\r\n");
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = req.nextUrl;
  const type = (searchParams.get("type") ?? "page_analytics") as ExportType;
  const days = Math.max(1, Math.min(Number(searchParams.get("days") ?? "30"), 365));
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  let rows: Record<string, unknown>[];
  let filename: string;
  let dbError: { message: string } | null;

  if (type === "page_analytics") {
    const res = await dc
      .from("page_analytics")
      .select("visit_date, visitor_key, path, duration_seconds, user_role")
      .gte("visit_date", since)
      .order("visit_date", { ascending: false })
      .limit(50000);
    rows = (res.data ?? []) as Record<string, unknown>[];
    dbError = res.error;
    filename = `page_analytics_${since}_to_${today}.csv`;
  } else if (type === "shop_views") {
    const res = await dc
      .from("shop_interactions")
      .select("created_at, vendor_id, source, event_type, visitor_key")
      .gte("created_at", `${since}T00:00:00Z`)
      .order("created_at", { ascending: false })
      .limit(50000);
    rows = (res.data ?? []) as Record<string, unknown>[];
    dbError = res.error;
    filename = `shop_views_${since}_to_${today}.csv`;
  } else if (type === "search_logs") {
    const res = await dc
      .from("search_logs")
      .select("searched_at, keyword")
      .gte("searched_at", `${since}T00:00:00Z`)
      .order("searched_at", { ascending: false })
      .limit(50000);
    rows = (res.data ?? []) as Record<string, unknown>[];
    dbError = res.error;
    filename = `search_logs_${since}_to_${today}.csv`;
  } else if (type === "consult_logs") {
    const res = await dc
      .from("consult_logs")
      .select("consulted_at, intent_category")
      .gte("consulted_at", `${since}T00:00:00Z`)
      .order("consulted_at", { ascending: false })
      .limit(50000);
    rows = (res.data ?? []) as Record<string, unknown>[];
    dbError = res.error;
    filename = `consult_logs_${since}_to_${today}.csv`;
  } else {
    return NextResponse.json({ error: "無効なエクスポート種別です" }, { status: 400 });
  }

  if (dbError) {
    console.error("[analytics/export] fetch error:", dbError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  const csv = toCSV(rows, COLUMNS[type]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
