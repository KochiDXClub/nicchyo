import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import {
  INTENTION_RESPONSE_COLUMNS,
  IntentionInputSchema,
  normalizeIntentionInput,
  rowToIntentionResponse,
  type IntentionResponseRow,
} from "@/lib/vendor/intention";
import { findOpenIntentionSeason, intentionDb, readOwnIntentionResponse } from "@/lib/vendor/intention.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 出店意向調査は、店舗の情報を編集できる人（store_edit）だけが答える・見る。
 * 店舗は必ず代表者・メンバーの所属から決める（本文の店舗 ID は見ない）。
 */
const PERMISSION = "store_edit" as const;

/** GET: 受付中の調査と、自分の店舗の回答 */
export async function GET() {
  const auth = await requireVendorContext({ permission: PERMISSION });
  if (!auth.ok) return auth.response;

  const db = intentionDb();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  try {
    const season = await findOpenIntentionSeason(db);
    const response = season ? await readOwnIntentionResponse(db, season.seasonYear, auth.vendorId) : null;
    return NextResponse.json({ season, response, editable: season !== null });
  } catch {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }
}

/** PUT: 受付中の調査に、自分の店舗の回答を書く（何度でも書き直せる） */
export async function PUT(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireVendorContext({ permission: PERMISSION });
  if (!auth.ok) return auth.response;

  const limited = await enforceRateLimit(request, {
    bucket: "vendor-intention",
    limit: 30,
    windowMs: 10 * 60 * 1000,
    identity: auth.user.id,
  });
  if (limited) return limited;

  const db = intentionDb();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = IntentionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }
  const input = normalizeIntentionInput(parsed.data);

  try {
    const season = await findOpenIntentionSeason(db);
    if (!season) return NextResponse.json({ error: "受付期間外のため、回答できません" }, { status: 409 });

    const { data, error } = await db
      .from("vendor_intention_responses")
      .upsert(
        {
          season_year: season.seasonYear,
          // 店舗は所属から決める（本文の値は使わない）
          vendor_id: auth.vendorId,
          booth_count: input.boothCount,
          frequency: input.frequency,
          preferred_months: input.preferredMonths,
          note: input.note,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "season_year,vendor_id" },
      )
      .select(INTENTION_RESPONSE_COLUMNS)
      .single();
    if (error || !data) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });

    return NextResponse.json({ season, response: rowToIntentionResponse(data as IntentionResponseRow) });
  } catch {
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
}
