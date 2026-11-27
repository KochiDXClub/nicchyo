import { NextResponse } from "next/server";
import { isAnalyticsCollectionEnabled } from "@/lib/analytics/collectionSettings.server";
import type { AnalyticsCollectionKey } from "@/lib/analytics/collectionSettings";
import { parseCountEvent, type CountEvent } from "@/lib/analytics/countEvents";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 種類ごとの取得設定と、数える RPC。種類を足すときはここに case を足す */
function countTarget(event: CountEvent): { toggle: AnalyticsCollectionKey; fn: string; args: Record<string, unknown> } {
  switch (event.kind) {
    case "usage":
      return { toggle: "featureUsage", fn: "increment_usage_daily", args: { p_feature: event.feature } };
  }
}

/**
 * POST /api/analytics/count  { kind: "usage", feature }
 *
 * 件数だけを数える計測の共通の入口（#1069）。保存するのは「日 × 種類ごとの値 → 件数」だけで、
 * 端末を見分ける ID・IP・時刻は持たない。重複の判定は端末側（sessionStorage）で行う。
 * 数える処理が失敗しても来訪者には関係がないので、記録だけして 200 を返す。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // 1 回の訪問で送るのは機能ごとに 1 回まで（今は最大 4 件）。タブを開き直しても足りる上限にする
  const rateLimited = await enforceRateLimit(request, {
    bucket: "analytics-count",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  // 取得設定は種類ごとに違うので、search-log と違い、種類を読んでから確かめる
  const event = parseCountEvent(await request.json().catch(() => null));
  if (!event) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const target = countTarget(event);
  if (!(await isAnalyticsCollectionEnabled(target.toggle))) return NextResponse.json({ ok: true, skipped: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  try {
    const { error } = await admin.rpc(target.fn, target.args);
    if (error) console.error(`[analytics-count] ${target.fn} error:`, error);
  } catch (e) {
    console.error(`[analytics-count] ${target.fn} error:`, e);
  }
  return NextResponse.json({ ok: true });
}
