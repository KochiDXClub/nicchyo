import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "../events/_helpers";
import { parseMarketDayRequest } from "@/lib/market/marketDayRequest.server";
import { saveMarketDay, type SavedMarketDay } from "@/lib/market/saveMarketDay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketDayRow = SavedMarketDay;

/** 直近の登録済みステータス一覧（管理画面での確認用） */
export async function GET() {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error: dbError } = await dc
    .from("market_days")
    .select("*")
    .order("market_date", { ascending: false })
    .limit(100);

  if (dbError) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ days: data as MarketDayRow[] });
}

/**
 * 開催ステータスの登録・更新（検証・upsert・監査ログは lib/market で高知市と共通）。
 */
export async function PUT(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-market-days-put",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = await parseMarketDayRequest(req);
  if ("response" in parsed) return parsed.response;
  const { data } = parsed;

  const result = await saveMarketDay(dc, { id: user.id, email: user.email, role: getRole(user) }, data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ day: result.day });
}
