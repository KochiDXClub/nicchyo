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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  await logAdminAudit(dc, { id: user.id, email: user.email, role: getRole(user) }, {
    action: "market_updated",
    targetType: "market",
    targetId: data.id,
    targetName: name,
    details: JSON.stringify({ slug, weekday, isPublic }),
  });

  return NextResponse.json({ market: data });
}
