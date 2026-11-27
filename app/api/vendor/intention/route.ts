import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import {
  INTENTION_RESPONSE_COLUMNS,
  IntentionChomeInputSchema,
  rowToIntentionResponse,
  type IntentionResponseRow,
} from "@/lib/vendor/intention";
import {
  findIntentionPlace,
  findOpenIntentionSeason,
  intentionDb,
  listIntentionPlaces,
  readOwnIntentionResponse,
  readVendorCurrentPlaceId,
} from "@/lib/vendor/intention.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 出店意向調査は、店舗の情報を編集できる人（store_edit）だけが答える・見る。
 * 店舗は必ず代表者・メンバーの所属から決める（本文の店舗 ID は見ない）。
 */
const PERMISSION = "store_edit" as const;

/** GET: 受付中の調査と、自分の店舗の回答、選べる場所。currentPlaceId は今出店している場所（初期選択に使う） */
export async function GET() {
  const auth = await requireVendorContext({ permission: PERMISSION });
  if (!auth.ok) return auth.response;

  const db = intentionDb();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  try {
    const season = await findOpenIntentionSeason(db);
    const response = season ? await readOwnIntentionResponse(db, season.seasonYear, auth.vendorId) : null;
    const places = season ? await listIntentionPlaces(db) : [];
    const currentPlaceId = season ? await readVendorCurrentPlaceId(db, auth.vendorId) : null;
    return NextResponse.json({ season, response, places, currentPlaceId, editable: season !== null });
  } catch {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }
}

/**
 * PUT: 受付中の調査に、自分の店舗の出店したい丁目を書く（何度でも書き直せる）。
 * 場所は任意。入れるときは、選んだ丁目の場所にする。
 */
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

  const parsed = IntentionChomeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }

  try {
    const season = await findOpenIntentionSeason(db);
    if (!season) return NextResponse.json({ error: "受付期間外のため、回答できません" }, { status: 409 });

    const placeId = parsed.data.placeId ?? null;
    if (placeId) {
      const place = await findIntentionPlace(db, placeId);
      // 場所は、選んだ丁目の場所だけ許す（丁目と場所がずれた回答を防ぐ）
      if (!place || place.chome !== parsed.data.chome) {
        return NextResponse.json({ error: "出店したい場所を選び直してください" }, { status: 400 });
      }
    }

    const { data, error } = await db
      .from("vendor_intention_responses")
      .upsert(
        {
          season_year: season.seasonYear,
          // 店舗は所属から決める（本文の値は使わない）
          vendor_id: auth.vendorId,
          chome: parsed.data.chome,
          place_id: placeId,
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
