import { NextResponse } from "next/server";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { parseMarketDayRequest } from "@/lib/market/marketDayRequest.server";
import { validateCityMarketDate } from "@/lib/market/marketDayInput";
import { todayJstString } from "@/lib/time/jstDate";
import { saveMarketDay } from "@/lib/market/saveMarketDay.server";
import { roleLabel } from "@/lib/audit/auditLogDisplay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 更新履歴として見せる件数 */
const HISTORY_LIMIT = 20;

type HistoryItem = {
  at: string;
  /** 「あなた」または更新した人のロール名（メールアドレスや ID は返さない） */
  by: string;
  marketDate: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
};

function parseDetails(details: string | null): {
  before: { status?: string } | null;
  after: { status?: string; note?: string | null } | null;
} {
  try {
    const json = details ? (JSON.parse(details) as Record<string, unknown>) : null;
    return {
      before: (json?.before ?? null) as { status?: string } | null,
      after: (json?.after ?? null) as { status?: string; note?: string | null } | null,
    };
  } catch {
    return { before: null, after: null };
  }
}

/**
 * 登録済みの開催ステータスと、直近の更新履歴。
 * 高知市に返すのは market_days の公開列と、開催ステータスの更新履歴だけ。
 */
export async function GET() {
  const auth = await requireCityApi();
  if ("error" in auth) return auth.error;
  const { user, adminClient: dc } = auth;

  const [daysResult, historyResult] = await Promise.all([
    dc
      .from("market_days")
      .select("market_date, status, note, updated_at")
      .order("market_date", { ascending: false })
      .limit(100),
    dc
      .from("admin_audit_logs")
      .select("created_at, actor_id, actor_role, target_id, details")
      .eq("action", "market_day_updated")
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);

  if (daysResult.error || historyResult.error) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  const history: HistoryItem[] = (historyResult.data ?? []).map((row) => {
    const { before, after } = parseDetails(row.details);
    return {
      at: row.created_at,
      by: row.actor_id === user.id ? "あなた" : (roleLabel(row.actor_role) ?? "運営"),
      marketDate: row.target_id,
      from: before?.status ?? null,
      to: after?.status ?? null,
      note: after?.note ?? null,
    };
  });

  return NextResponse.json({ days: daysResult.data ?? [], history });
}

/**
 * 開催ステータスの登録・更新。保存した内容は即座に全ユーザーのマップ・近況ページ最上部に
 * 反映される。検証・保存・監査ログは運営と共通（lib/market）で、actor_role に city_official が残る。
 */
export async function PUT(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "city-market-days-put",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const auth = await requireCityApi();
  if ("error" in auth) return auth.error;
  const { user, role, adminClient: dc } = auth;

  const parsed = await parseMarketDayRequest(req);
  if ("response" in parsed) return parsed.response;
  const { data } = parsed;

  // 市が書けるのは、今日から先の日曜だけ（過去の開催実績は書き換えさせない）
  const dateError = validateCityMarketDate(data.market_date, todayJstString());
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });

  const result = await saveMarketDay(dc, { id: user.id, email: user.email, role }, data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // updated_by（アカウントの ID）は返さない
  const { market_date, status, note, updated_at } = result.day;
  return NextResponse.json({ day: { market_date, status, note, updated_at } });
}
