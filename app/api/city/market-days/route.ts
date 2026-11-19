import { NextResponse } from "next/server";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { parseMarketDayRequest } from "@/lib/market/marketDayRequest.server";
import { validateCityMarketDate } from "@/lib/market/marketDayInput";
import { todayJstString } from "@/lib/time/jstDate";
import { readDefaultMarketId, saveMarketDay } from "@/lib/market/saveMarketDay.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 更新履歴として見せる件数 */
const HISTORY_LIMIT = 20;
const HISTORY_QUERY_LIMIT = 100;

type HistoryItem = {
  at: string;
  /** 「あなた」「高知市」「運営」のどれか（運営の細かいロール名・メールアドレス・ID は返さない） */
  by: string;
  marketDate: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
};

function parseDetails(details: string | null): {
  marketId: string | null;
  before: { status?: string } | null;
  after: { status?: string; note?: string | null } | null;
} {
  try {
    const json = details ? (JSON.parse(details) as Record<string, unknown>) : null;
    return {
      marketId: typeof json?.market_id === "string" ? json.market_id : null,
      before: (json?.before ?? null) as { status?: string } | null,
      after: (json?.after ?? null) as { status?: string; note?: string | null } | null,
    };
  } catch {
    return { marketId: null, before: null, after: null };
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
  const sundayId = await readDefaultMarketId(dc);
  if (!sundayId) return NextResponse.json({ error: "日曜市を取得できませんでした" }, { status: 503 });

  const [daysResult, historyResult] = await Promise.all([
    dc
      .from("market_days")
      .select("market_date, status, note, updated_at")
      .eq("market_id", sundayId)
      .order("market_date", { ascending: false })
      .limit(100),
    dc
      .from("admin_audit_logs")
      .select("created_at, actor_id, actor_role, target_id, details")
      .eq("action", "market_day_updated")
      .order("created_at", { ascending: false })
      .limit(HISTORY_QUERY_LIMIT),
  ]);

  if (daysResult.error || historyResult.error) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  const history: HistoryItem[] = (historyResult.data ?? []).flatMap((row): HistoryItem[] => {
    const { marketId, before, after } = parseDetails(row.details);
    // 市IDが入る前の履歴は、従来どおり日曜市の履歴として扱う。
    if (marketId && marketId !== sundayId) return [];
    return [{
      at: row.created_at,
      by: row.actor_id === user.id ? "あなた" : row.actor_role === "city_official" ? "高知市" : "運営",
      marketDate: row.target_id,
      from: before?.status ?? null,
      to: after?.status ?? null,
      note: after?.note ?? null,
    }];
  }).slice(0, HISTORY_LIMIT);

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
  // 画像は運営だけが扱う。市の API から送られても画像は変えない（キーを外して保存する）
  delete data.image_url;
  if (data.market_id !== undefined) {
    return NextResponse.json({ error: "高知市向けの画面から変更できるのは日曜市のみです" }, { status: 400 });
  }

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
