import { NextResponse } from "next/server";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { loadSearchKeywordCounts } from "@/lib/analytics/searchTrends.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 出店者の分析に出す件数 */
const TREND_LIMIT = 10;

/**
 * GET: 日曜市全体の、直近7日のよく検索された語（上位10件）。出店者の分析の「検索トレンド」用。
 *
 * 生の検索語はブラウザに渡さず、ここで数えた「語と回数」だけを返す（#922）。
 * 分析の閲覧の権限があるメンバーだけが読める。
 */
export async function GET() {
  const auth = await requireVendorContext({ permission: "analytics" });
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const counts = await loadSearchKeywordCounts(admin);
  return NextResponse.json({ keywords: counts.slice(0, TREND_LIMIT) });
}
