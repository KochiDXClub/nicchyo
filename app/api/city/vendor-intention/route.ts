import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { rowToIntentionSeason, type IntentionSeasonRow, INTENTION_SEASON_COLUMNS } from "@/lib/vendor/intention";
import { findLatestIntentionSeason, loadIntentionSummary } from "@/lib/vendor/intention.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: 出店意向調査の集計（場所ごとの件数だけ）。
 * 高知市（と運営）に返すのは季節の情報と集計だけ。店舗ごとの回答・店名・ひとことは返さない。
 * ?season=2027 で季節を選べる（省略時は最新の季節）。
 */
export async function GET(request: Request) {
  const auth = await requireCityApi();
  if ("error" in auth) return auth.error;
  // 集計は service_role で読むが、返すのは下の summary だけ
  const db = auth.adminClient as unknown as SupabaseClient;

  const seasonParam = new URL(request.url).searchParams.get("season");
  try {
    let season = null;
    if (seasonParam === null) {
      season = await findLatestIntentionSeason(db);
    } else {
      const year = Number(seasonParam);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return NextResponse.json({ error: "季節の指定を確かめてください" }, { status: 400 });
      }
      const { data, error } = await db
        .from("vendor_intention_seasons")
        .select(INTENTION_SEASON_COLUMNS)
        .eq("season_year", year)
        .maybeSingle();
      if (error) throw error;
      season = data ? rowToIntentionSeason(data as IntentionSeasonRow) : null;
    }
    if (!season) return NextResponse.json({ season: null, summary: null });

    // 市役所には件数（丁目・場所ごと）だけを返す。少数の項目は伏せる（mask: true）
    const summary = await loadIntentionSummary(db, season.seasonYear, { mask: true });
    return NextResponse.json({ season, summary });
  } catch {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }
}
