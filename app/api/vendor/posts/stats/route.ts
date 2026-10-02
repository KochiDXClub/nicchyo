import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { parseContentIdsParam } from "@/lib/story/reactionCounts";
import { POST_STATS_MAX_IDS, toPostStats } from "@/lib/story/postStats";

export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/posts/stats?ids=<uuid,uuid,...>
 *
 * 自店舗の近況ごとに「見た人」と「ハート」の数を返す。
 * 見た人の数は店舗のメンバーだけが見られる数なので、自店舗の投稿の id だけを数える。
 */
export async function GET(req: Request) {
  const rateLimited = await enforceRateLimit(req, {
    bucket: "vendor-post-stats",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  // 近況ごとの「見た人」「ハート」は分析の数字なので、分析の権限で絞る
  const auth = await requireVendorContext({ permission: "analytics" });
  if (!auth.ok) return auth.response;
  const { vendorId, supabase: session } = auth;

  const ids = parseContentIdsParam(new URL(req.url).searchParams.get("ids"));
  if (ids.length === 0) return NextResponse.json({ stats: {} });
  if (ids.length > POST_STATS_MAX_IDS) {
    return NextResponse.json({ error: `ids は最大${POST_STATS_MAX_IDS}件までです` }, { status: 400 });
  }

  // 自店舗の投稿だけに絞る（他店の id を混ぜても数は返さない）
  const { data: owned, error: ownedError } = await session
    .from("vendor_contents")
    .select("id")
    .eq("vendor_id", vendorId)
    .in("id", ids);
  if (ownedError) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const ownedIds = (owned ?? []).map((row) => row.id as string);
  if (ownedIds.length === 0) return NextResponse.json({ stats: {} });

  // 見た人・ハートは service_role でしか読めない（匿名のポリシーが無い）
  const admin = createAdminClient() as unknown as SupabaseClient | null;
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const [views, hearts] = await Promise.all([
    admin.rpc("get_view_counts", { content_ids: ownedIds }),
    admin.rpc("get_reaction_counts", { content_ids: ownedIds }),
  ]);
  if (views.error || hearts.error) {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }

  return NextResponse.json({ stats: toPostStats(ownedIds, views.data ?? [], hearts.data ?? []) });
}
