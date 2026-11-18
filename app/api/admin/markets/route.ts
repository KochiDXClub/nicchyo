import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { authorizeAdmin } from "../events/_helpers";
import { parseMarketInput } from "@/lib/market/marketInput";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MARKET_SLUG = "nichiyo";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 市に予定（場所の予定か例外）があるかどうか。取得に失敗したら null。 */
async function marketHasSchedules(dc: NonNullable<ReturnType<typeof createAdminClient>>, marketId: string): Promise<boolean | null> {
  const { data: places, error: placeError } = await dc.from("market_locations").select("id").eq("market_id", marketId);
  if (placeError) return null;
  const placeIds = (places ?? []).map((place) => place.id);
  if (placeIds.length === 0) return false;

  const { count: overrideCount, error: overrideError } = await dc
    .from("market_place_schedule_overrides")
    .select("location_id", { count: "exact", head: true })
    .in("location_id", placeIds);
  if (overrideError) return null;
  if ((overrideCount ?? 0) > 0) return true;

  const { data: memberships, error: membershipError } = await dc
    .from("market_place_memberships")
    .select("id")
    .in("location_id", placeIds);
  if (membershipError) return null;
  const membershipIds = (memberships ?? []).map((membership) => membership.id);
  if (membershipIds.length === 0) return false;

  const { count: ruleCount, error: ruleError } = await dc
    .from("market_place_schedule_rules")
    .select("id", { count: "exact", head: true })
    .in("membership_id", membershipIds);
  if (ruleError) return null;
  return (ruleCount ?? 0) > 0;
}

/** 市の一覧（非公開の市も含む。管理者だけが呼べる） */
export async function GET() {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error: dbError } = await dc.from("markets").select("*").order("slug", { ascending: true });
  if (dbError) return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ markets: data ?? [] });
}

/** 市の新規登録 */
export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-markets-post",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = parseMarketInput(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, slug, weekday, isPublic } = parsed.data;

  const { data, error: dbError } = await dc
    .from("markets")
    .insert({ name, slug, weekday, is_public: isPublic })
    .select("*")
    .single();
  if (dbError || !data) {
    const duplicate = dbError?.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "その公開URLの名前は使われています" : "市の登録に失敗しました" },
      { status: duplicate ? 409 : 500 },
    );
  }

  revalidatePath("/sitemap.xml");

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_created",
    targetType: "market",
    targetId: data.id,
    targetName: name,
    details: JSON.stringify({ slug, weekday, isPublic }),
  });

  return NextResponse.json({ market: data }, { status: 201 });
}

/** 市の編集（名前・公開URLの名前・開催曜日・公開の切り替え） */
export async function PATCH(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-markets-patch",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
    return NextResponse.json({ error: "市の指定が正しくありません" }, { status: 400 });
  }
  const parsed = parseMarketInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, slug, weekday, isPublic } = parsed.data;

  const { data: current, error: currentError } = await dc
    .from("markets")
    .select("id,slug,weekday")
    .eq("id", body.id)
    .maybeSingle();
  if (currentError) return NextResponse.json({ error: "市の更新に失敗しました" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "市が見つかりません" }, { status: 404 });

  // 日曜市の公開URLの名前は、既定の市を見つける目印なので変えられない
  if (current.slug === DEFAULT_MARKET_SLUG && slug !== DEFAULT_MARKET_SLUG) {
    return NextResponse.json({ error: "既定の市（日曜市）の公開URLの名前は変えられません" }, { status: 400 });
  }

  // 曜日を変えると、予定と例外の日付が古い曜日のまま残るため、予定がある間は変えられない
  if (current.weekday !== weekday) {
    const scheduled = await marketHasSchedules(dc, body.id);
    if (scheduled === null) return NextResponse.json({ error: "市の更新に失敗しました" }, { status: 500 });
    if (scheduled) {
      return NextResponse.json({ error: "この市には予定があるため、開催曜日は変えられません" }, { status: 409 });
    }
  }

  const { data, error: dbError } = await dc
    .from("markets")
    .update({ name, slug, weekday, is_public: isPublic, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select("*")
    .maybeSingle();
  if (dbError) {
    const duplicate = dbError.code === "23505";
    return NextResponse.json(
      { error: duplicate ? "その公開URLの名前は使われています" : "市の更新に失敗しました" },
      { status: duplicate ? 409 : 500 },
    );
  }
  if (!data) return NextResponse.json({ error: "市が見つかりません" }, { status: 404 });

  revalidatePath("/sitemap.xml");

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_updated",
    targetType: "market",
    targetId: data.id,
    targetName: name,
    details: JSON.stringify({ slug, weekday, isPublic }),
  });

  return NextResponse.json({ market: data });
}
