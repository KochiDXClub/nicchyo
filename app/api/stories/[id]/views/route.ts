import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { normalizeVisitorKey, isValidContentId } from "../reactions/_helpers";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/stories/[id]/views  { visitorKey }
 *
 * 近況を「見た」と記録する。同じ visitorKey は1投稿につき1回だけ数える（unique 制約）。
 * 出店者が自分の近況を開いたときは数えない（見られた数が自分で増えないように）。
 * 数を読むのは出店者本人だけ（GET /api/vendor/posts/stats）。
 */
export async function POST(req: Request, { params }: Params) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  // 近況を次々に送って見るので、ハートより広めにとる
  const rateLimited = await enforceRateLimit(req, {
    bucket: "story-views",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  if (!isValidContentId(id)) {
    return NextResponse.json({ error: "不正な id です" }, { status: 400 });
  }
  // 同じ IP から1つの近況を何度も数えさせない（visitorKey は好きな値を送れるため）
  const perPostLimited = await enforceRateLimit(req, {
    bucket: "story-views-per-post",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keySuffix: id,
  });
  if (perPostLimited) return perPostLimited;

  const body = (await req.json().catch(() => ({}))) as { visitorKey?: unknown };
  const visitorKey = normalizeVisitorKey(body.visitorKey);
  if (!visitorKey) {
    return NextResponse.json({ error: "visitorKey が必要です" }, { status: 400 });
  }

  // content_views は生成済み Database 型に未登録のため型は付けない（content_reactions と同じ）
  const supabase = createAdminClient() as unknown as SupabaseClient | null;
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // 公開中の近況だけを数える（期限切れ・非表示の投稿には記録しない）
  const { data: content } = await supabase
    .from("vendor_contents")
    .select("vendor_id")
    .eq("id", id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  // 応答からは「このキーで見たことがあるか」を分からないようにする（いつも同じ形で返す）
  if (!content) return NextResponse.json({ ok: true });

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  if (user?.id === content.vendor_id) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("content_views")
    .insert({ vendor_content_id: id, visitor_key: visitorKey });
  // 2回目以降（unique 制約違反）は、すでに数えたものとして扱う
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: "記録できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
