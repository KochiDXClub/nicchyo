import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { todayJstString } from "@/lib/time/jstDate";
import { INTENTION_SEASON_COLUMNS, rowToIntentionSeason, type IntentionSeasonRow } from "@/lib/vendor/intention";
import { listIntentionSeasons } from "@/lib/vendor/intention.server";
import { SeasonCreateSchema, findOverlappingSeason } from "@/lib/vendor/intentionSeasonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: 出店意向調査の季節一覧（運営だけ）。today は日本時間の今日（状態の判定に使う） */
export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const db = auth.adminClient as unknown as SupabaseClient;
    const seasons = await listIntentionSeasons(db);
    return NextResponse.json({ today: todayJstString(), seasons }, { headers: privateNoStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "季節の一覧を読み込めませんでした" }, { status: 500 });
  }
}

/** POST: 季節（受付期間）を新しく作る。作っただけでは受付は始まらない（開始日の当日から） */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-vendor-intention-season-post", limit: 60, json: true });
    if ("error" in guard) return guard.error;

    const parsed = SeasonCreateSchema.safeParse(guard.body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" }, { status: 400 });
    }
    const input = parsed.data;
    const db = guard.ctx.adminClient as unknown as SupabaseClient;

    const existing = await listIntentionSeasons(db);
    if (existing.some((season) => season.seasonYear === input.seasonYear)) {
      return NextResponse.json({ error: `${input.seasonYear}年の季節はすでにあります` }, { status: 409 });
    }
    const overlap = findOverlappingSeason(input, existing);
    if (overlap) {
      return NextResponse.json(
        { error: `${overlap.seasonYear}年（${overlap.opensOn}〜${overlap.closesOn}）の受付期間と重なっています` },
        { status: 409 },
      );
    }

    const { data, error } = await db
      .from("vendor_intention_seasons")
      .insert({ season_year: input.seasonYear, title: input.title, opens_on: input.opensOn, closes_on: input.closesOn })
      .select(INTENTION_SEASON_COLUMNS)
      .single();
    if (error || !data) {
      const duplicate = error?.code === "23505";
      return NextResponse.json(
        { error: duplicate ? `${input.seasonYear}年の季節はすでにあります` : "季節を作れませんでした" },
        { status: duplicate ? 409 : 500 },
      );
    }
    const season = rowToIntentionSeason(data as IntentionSeasonRow);

    await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, {
      action: "vendor_intention_season_create",
      targetType: "vendor_intention_season",
      targetId: String(input.seasonYear),
      targetName: input.title,
      details: JSON.stringify({ opensOn: input.opensOn, closesOn: input.closesOn }),
      ipAddress: guard.ctx.ip,
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "季節を作れませんでした" }, { status: 500 });
  }
}
