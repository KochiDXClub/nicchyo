import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import {
  aggregateReactionRows,
  parseContentIdsParam,
  REACTION_COUNTS_MAX_IDS,
} from "@/lib/story/reactionCounts";

export const dynamic = "force-dynamic";

// visitorKey の受理条件は stories/[id]/reactions と同じ（空でない・128文字以内）
function normalizeVisitorKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const vk = raw.trim();
  return vk.length > 0 && vk.length <= 128 ? vk : null;
}

/**
 * GET /api/reactions/counts?ids=<uuid,uuid,...>&visitorKey=<任意>
 *
 * 複数の投稿（vendor_contents）のハート数を一括取得する。
 * visitorKey を渡すと、その訪問者がハート済みの id 一覧も返す。
 * マップのショップバナー・出店者の投稿履歴・ストーリー一覧で共用する。
 *
 * ハート数自体は公開情報だが、visitorKey が URL に含まれるため
 * per-id GET（stories/[id]/reactions）と同様に same-origin を課す
 * （visitorKey が漏れた場合の「どの投稿にハートしたか」照会封じ）。
 * 書き込みは引き続き stories/[id]/reactions の POST のみ。
 */
export async function GET(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "reaction-counts",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const ids = parseContentIdsParam(url.searchParams.get("ids"));
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids が必要です" }, { status: 400 });
  }
  if (ids.length > REACTION_COUNTS_MAX_IDS) {
    return NextResponse.json(
      { error: `ids は最大${REACTION_COUNTS_MAX_IDS}件までです` },
      { status: 400 }
    );
  }
  const visitorKey = normalizeVisitorKey(url.searchParams.get("visitorKey"));

  // 読み取りはサービスロールで行う（content_reactions に匿名ポリシーは無い）。
  // content_reactions は生成済み Database 型に未登録のため型は付けない。
  const supabase = createAdminClient() as unknown as SupabaseClient | null;
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("content_reactions")
    .select("vendor_content_id, visitor_key")
    .in("vendor_content_id", ids);

  if (error) {
    return NextResponse.json(
      { error: "リアクションの取得に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    aggregateReactionRows(
      (data ?? []) as Array<{ vendor_content_id: string; visitor_key: string }>,
      visitorKey
    )
  );
}
