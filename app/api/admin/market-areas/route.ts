import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";
import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseMarketAreaLabel, type MarketArea } from "@/lib/market/marketAreas";
import { authorizeAdmin } from "../events/_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WRITE_RATE_LIMIT = { limit: 60, windowMs: 10 * 60 * 1000 };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type AreaRow = { id: string; market_id: string; label: string; sort_order: number };

function toMarketArea(row: AreaRow): MarketArea {
  return { id: row.id, marketId: row.market_id, label: row.label, sortOrder: row.sort_order };
}

async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** 丁目の1件を読む（無ければ null） */
async function findArea(dc: AdminClient, id: string): Promise<AreaRow | null> {
  const { data } = await dc.from("market_areas").select("id, market_id, label, sort_order").eq("id", id).maybeSingle();
  return (data as AreaRow | null) ?? null;
}

/** 指定した市の丁目一覧（並び順どおり）。管理者だけが呼べる */
export async function GET(req: Request) {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const marketId = new URL(req.url).searchParams.get("marketId") ?? "";
  if (!UUID_PATTERN.test(marketId)) return NextResponse.json({ error: "市の指定が正しくありません" }, { status: 400 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data, error: dbError } = await dc
    .from("market_areas")
    .select("id, market_id, label, sort_order")
    .eq("market_id", marketId)
    .order("sort_order", { ascending: true });
  if (dbError) return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ areas: ((data ?? []) as AreaRow[]).map(toMarketArea) });
}

/** 丁目の追加（並び順は末尾） */
export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, { bucket: "admin-market-areas-post", ...WRITE_RATE_LIMIT });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await readJsonObject(req);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  if (!UUID_PATTERN.test(marketId)) return NextResponse.json({ error: "市の指定が正しくありません" }, { status: 400 });
  const parsed = parseMarketAreaLabel(body?.label);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data: last } = await dc
    .from("market_areas")
    .select("sort_order")
    .eq("market_id", marketId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = ((last?.[0]?.sort_order as number | undefined) ?? 0) + 1;

  const { data, error: dbError } = await dc
    .from("market_areas")
    .insert({ market_id: marketId, label: parsed.label, sort_order: sortOrder })
    .select("id, market_id, label, sort_order")
    .single();
  if (dbError || !data) {
    if (dbError?.code === "23505") return NextResponse.json({ error: "同じ名前の丁目がこの市にすでにあります" }, { status: 409 });
    if (dbError?.code === "23503") return NextResponse.json({ error: "市が見つかりません" }, { status: 404 });
    return NextResponse.json({ error: "丁目の登録に失敗しました" }, { status: 500 });
  }

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_area_created",
    targetType: "market_area",
    targetId: data.id,
    targetName: parsed.label,
    details: JSON.stringify({ marketId, sortOrder }),
  });

  return NextResponse.json({ area: toMarketArea(data as AreaRow) }, { status: 201 });
}

/** 丁目の名前変更（同じ市の区画の丁目も同時に変わる） */
export async function PATCH(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, { bucket: "admin-market-areas-patch", ...WRITE_RATE_LIMIT });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await readJsonObject(req);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "丁目の指定が正しくありません" }, { status: 400 });
  const parsed = parseMarketAreaLabel(body?.label);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const before = await findArea(dc, id);
  if (!before) return NextResponse.json({ error: "丁目が見つかりません" }, { status: 404 });

  const { error: dbError } = await dc.rpc("rename_market_area", { p_id: id, p_label: parsed.label });
  if (dbError) {
    if (dbError.code === "23505") return NextResponse.json({ error: "同じ名前の丁目がこの市にすでにあります" }, { status: 409 });
    if (dbError.code === "P0002") return NextResponse.json({ error: "丁目が見つかりません" }, { status: 404 });
    return NextResponse.json({ error: "丁目の名前を変えられませんでした" }, { status: 500 });
  }

  // 区画の丁目（district）が変わるので、公開マップの店舗データを作り直す
  revalidatePublicShops();

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_area_renamed",
    targetType: "market_area",
    targetId: id,
    targetName: parsed.label,
    details: JSON.stringify({ marketId: before.market_id, from: before.label, to: parsed.label }),
  });

  return NextResponse.json({ area: toMarketArea({ ...before, label: parsed.label }) });
}

/** 丁目の並べ替え。marketId の丁目を、ids の順に並べ直す（過不足があれば変えない） */
export async function PUT(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, { bucket: "admin-market-areas-put", ...WRITE_RATE_LIMIT });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await readJsonObject(req);
  const marketId = typeof body?.marketId === "string" ? body.marketId : "";
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  if (!UUID_PATTERN.test(marketId) || !ids || ids.length === 0 || !ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
    return NextResponse.json({ error: "並び順の指定が正しくありません" }, { status: 400 });
  }

  const { error: dbError } = await dc.rpc("reorder_market_areas", { p_market_id: marketId, p_ids: ids });
  if (dbError) {
    if (dbError.code === "23514") return NextResponse.json({ error: "丁目が変わったため、並べ替えを取り消しました。読み直してください。" }, { status: 409 });
    return NextResponse.json({ error: "並べ替えに失敗しました" }, { status: 500 });
  }

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_areas_reordered",
    targetType: "market",
    targetId: marketId,
    details: JSON.stringify({ ids }),
  });

  return NextResponse.json({ ok: true });
}

/** 丁目の削除。その丁目の区画がある間は削除しない（区画の丁目が消えてしまうのを防ぐ） */
export async function DELETE(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, { bucket: "admin-market-areas-delete", ...WRITE_RATE_LIMIT });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await readJsonObject(req);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "丁目の指定が正しくありません" }, { status: 400 });

  const area = await findArea(dc, id);
  if (!area) return NextResponse.json({ error: "丁目が見つかりません" }, { status: 404 });

  const { count, error: countError } = await dc
    .from("market_locations")
    .select("id", { count: "exact", head: true })
    .eq("market_id", area.market_id)
    .eq("district", area.label);
  if (countError) return NextResponse.json({ error: "区画の確認に失敗しました" }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `この丁目の区画が ${count} 件あるため削除できません。先に区画の丁目を変えてください。` },
      { status: 409 },
    );
  }

  const { error: dbError } = await dc.from("market_areas").delete().eq("id", id);
  if (dbError) return NextResponse.json({ error: "丁目の削除に失敗しました" }, { status: 500 });

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_area_deleted",
    targetType: "market_area",
    targetId: id,
    targetName: area.label,
    details: JSON.stringify({ marketId: area.market_id }),
  });

  return NextResponse.json({ ok: true });
}
