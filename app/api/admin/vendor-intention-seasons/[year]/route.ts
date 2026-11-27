import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { todayJstString } from "@/lib/time/jstDate";
import { INTENTION_SEASON_COLUMNS, rowToIntentionSeason, type IntentionSeasonRow } from "@/lib/vendor/intention";
import { listIntentionSeasons } from "@/lib/vendor/intention.server";
import {
  SEASON_YEAR_MAX,
  SEASON_YEAR_MIN,
  findOverlappingSeason,
  windowForCloseNow,
  windowForOpenNow,
} from "@/lib/vendor/intentionSeasonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH: 季節の受付を今すぐ開く・閉じる（{ action: "open" | "close" }）。
 * 開くと開始日を今日に、閉じると締切日を昨日にそろえる。ほかの季節と重なるときは拒否する。
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ year: string }> }) {
  try {
    const { year: rawYear } = await params;
    const year = Number(rawYear);
    if (!Number.isInteger(year) || year < SEASON_YEAR_MIN || year > SEASON_YEAR_MAX) {
      return NextResponse.json({ error: "季節の年を確かめてください" }, { status: 400 });
    }

    const guard = await guardAdminWrite(request, { bucket: "admin-vendor-intention-season-patch", limit: 60, json: true });
    if ("error" in guard) return guard.error;
    const body = guard.body as { action?: unknown } | null;
    if (!body || (body.action !== "open" && body.action !== "close")) {
      return NextResponse.json({ error: "操作を確かめてください" }, { status: 400 });
    }
    const db = guard.ctx.adminClient as unknown as SupabaseClient;

    const seasons = await listIntentionSeasons(db);
    const current = seasons.find((season) => season.seasonYear === year);
    if (!current) return NextResponse.json({ error: "季節が見つかりません" }, { status: 404 });

    const today = todayJstString();
    const next = body.action === "open" ? windowForOpenNow(current, today) : windowForCloseNow(current, today);
    const overlap = findOverlappingSeason(next, seasons, year);
    if (overlap) {
      return NextResponse.json(
        { error: `${overlap.seasonYear}年（${overlap.opensOn}〜${overlap.closesOn}）の受付期間と重なるため、開けません` },
        { status: 409 },
      );
    }

    const { data, error } = await db
      .from("vendor_intention_seasons")
      .update({ opens_on: next.opensOn, closes_on: next.closesOn })
      .eq("season_year", year)
      .select(INTENTION_SEASON_COLUMNS)
      .single();
    if (error || !data) return NextResponse.json({ error: "受付の状態を変えられませんでした" }, { status: 500 });
    const season = rowToIntentionSeason(data as IntentionSeasonRow);

    await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, {
      action: "vendor_intention_season_edit",
      targetType: "vendor_intention_season",
      targetId: String(year),
      targetName: current.title,
      details: JSON.stringify({ action: body.action, opensOn: next.opensOn, closesOn: next.closesOn }),
      ipAddress: guard.ctx.ip,
    });

    return NextResponse.json({ season });
  } catch {
    return NextResponse.json({ error: "受付の状態を変えられませんでした" }, { status: 500 });
  }
}
