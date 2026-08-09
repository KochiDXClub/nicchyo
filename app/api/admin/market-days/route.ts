import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "../events/_helpers";
import { normalizeStatus, toIsoDate, type MarketDayStatus } from "@/lib/market/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: MarketDayStatus[] = ["open", "cancelled", "special", "closed"];

type MarketDayRow = {
  market_date: string;
  status: string;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

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

function validateBody(body: unknown): {
  data: { market_date: string; status: MarketDayStatus; note: string | null } | null;
  error: string | null;
} {
  if (!body || typeof body !== "object") return { data: null, error: "無効なリクエストです" };
  const b = body as Record<string, unknown>;

  const marketDate = typeof b.market_date === "string" ? b.market_date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) {
    return { data: null, error: "日付の形式が無効です（YYYY-MM-DD）" };
  }
  // 実在しない日付を弾く。Date は 2026-02-31 を 3/3 にロールオーバーして
  // Invalid にならないため、往復させて入力と一致するかで判定する。
  // JST 正午として解釈することで、toIsoDate（JST基準）と暦日がずれないようにする。
  const parsed = new Date(`${marketDate}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== marketDate) {
    return { data: null, error: "存在しない日付です" };
  }
  const year = Number(marketDate.slice(0, 4));
  if (year < 2020 || year > 2100) {
    return { data: null, error: "日付が範囲外です" };
  }

  const status = typeof b.status === "string" ? b.status : "";
  if (!VALID_STATUSES.includes(status as MarketDayStatus)) {
    return { data: null, error: "ステータスが無効です" };
  }

  return {
    data: {
      market_date: marketDate,
      status: normalizeStatus(status),
      note: typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null,
    },
    error: null,
  };
}

/**
 * 開催ステータスの登録・更新。
 * 1日1件なので、同じ日付に対しては upsert して上書きする（「ワンタップで切り替える」運用のため）。
 *
 * 保存した内容は下書きを挟まず即座に全ユーザーのマップ・近況ページ最上部に反映される。
 * この機能で最も影響の大きい操作なので、変更前後を監査ログに残す。
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 });
  }

  const { data, error: validError } = validateBody(body);
  if (!data || validError) {
    return NextResponse.json({ error: validError ?? "無効なリクエストです" }, { status: 400 });
  }

  // 誤操作を事後に検証できるよう、上書き前の内容を控えておく
  const { data: previous } = await dc
    .from("market_days")
    .select("status, note")
    .eq("market_date", data.market_date)
    .maybeSingle();

  const { data: day, error: dbError } = await dc
    .from("market_days")
    .upsert({ ...data, updated_by: user.id }, { onConflict: "market_date" })
    .select("*")
    .single();

  if (dbError) {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }

  const { error: auditError } = await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "market_day_updated",
    target_type: "market_day",
    target_id: data.market_date,
    details: JSON.stringify({
      before: previous ? { status: previous.status, note: previous.note } : null,
      after: { status: data.status, note: data.note },
    }),
  });
  if (auditError) {
    // 監査ログの失敗で保存自体を巻き戻すことはしないが、無言で消さない
    console.error("[admin/market-days] 監査ログの記録に失敗しました", auditError);
  }

  return NextResponse.json({ day: day as MarketDayRow });
}
