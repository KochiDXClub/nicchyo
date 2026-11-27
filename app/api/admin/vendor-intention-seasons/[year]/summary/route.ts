import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { rowToIntentionSeason, INTENTION_SEASON_COLUMNS, type IntentionSeasonRow } from "@/lib/vendor/intention";
import { loadIntentionSummary } from "@/lib/vendor/intention.server";
import { SEASON_YEAR_MAX, SEASON_YEAR_MIN } from "@/lib/vendor/intentionSeasonAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: 季節の回答の集計（丁目ごと・場所ごと）。運営だけが見る。
 * 運営の画面は伏せずに件数を見る。店舗ごとの回答（誰が何を選んだか）は返さない。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ year: string }> }) {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const { year: rawYear } = await params;
    const year = Number(rawYear);
    if (!Number.isInteger(year) || year < SEASON_YEAR_MIN || year > SEASON_YEAR_MAX) {
      return NextResponse.json({ error: "季節の年を確かめてください" }, { status: 400 });
    }

    const db = auth.adminClient as unknown as SupabaseClient;
    const { data, error } = await db.from("vendor_intention_seasons").select(INTENTION_SEASON_COLUMNS).eq("season_year", year).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "季節が見つかりません" }, { status: 404 });

    const summary = await loadIntentionSummary(db, year, { mask: false });
    return NextResponse.json(
      { season: rowToIntentionSeason(data as IntentionSeasonRow), summary },
      { headers: privateNoStoreHeaders() },
    );
  } catch {
    return NextResponse.json({ error: "集計を読み込めませんでした" }, { status: 500 });
  }
}
