import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { parseSearchLog } from "@/lib/analytics/searchLogs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/search-log  { keyword, resultCount }
 *
 * 来訪者の検索キーワードを product_search_logs に記録する（出店者の「お店の分析」の検索トレンド用）。
 * これまではブラウザから直接 INSERT していたため、入力検証もレート制限も効かなかった。
 * 書き込みはここ（service role）に寄せる。保存するのはキーワード・件数・日時だけで、IP などは持たない。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // 検索は1秒のデバウンス後に送られる。打ち直しが続いても足りる上限にする
  const rateLimited = await enforceRateLimit(request, {
    bucket: "analytics-search-log",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const log = parseSearchLog(await request.json().catch(() => null));
  if (!log) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  // 同じ IP から同じ語を何度も送らせない。連打で出店者の「検索トレンド」上位に
  // 任意の語を押し込めないようにする
  const perKeywordLimited = await enforceRateLimit(request, {
    bucket: "analytics-search-log-per-keyword",
    limit: 3,
    windowMs: 10 * 60 * 1000,
    keySuffix: log.keyword.toLowerCase(),
  });
  if (perKeywordLimited) return perKeywordLimited;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { error } = await admin
    .from("product_search_logs")
    .insert({ keyword: log.keyword, result_count: log.resultCount });
  if (error) {
    console.error("[search-log] insert error:", error);
    return NextResponse.json({ error: "記録できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
