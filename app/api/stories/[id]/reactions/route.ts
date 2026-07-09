import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// visitorKey の受理条件は ask/route.ts に倣う（空でない・128文字以内）
function normalizeVisitorKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const vk = raw.trim();
  return vk.length > 0 && vk.length <= 128 ? vk : null;
}

async function readReactionState(
  supabase: SupabaseClient,
  contentId: string,
  visitorKey: string
): Promise<{ count: number; reacted: boolean }> {
  const [countResult, mineResult] = await Promise.all([
    supabase
      .from("content_reactions")
      .select("*", { count: "exact", head: true })
      .eq("vendor_content_id", contentId),
    supabase
      .from("content_reactions")
      .select("id")
      .eq("vendor_content_id", contentId)
      .eq("visitor_key", visitorKey)
      .maybeSingle(),
  ]);

  return {
    count: countResult.count ?? 0,
    reacted: !!mineResult.data,
  };
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const visitorKey = normalizeVisitorKey(new URL(req.url).searchParams.get("visitorKey"));
  if (!visitorKey) {
    return NextResponse.json({ error: "visitorKey が必要です" }, { status: 400 });
  }

  // 読み書きはすべてサービスロールで行う（直接の匿名アクセスは許可しない）。
  // content_reactions は生成済み Database 型に未登録のため型は付けない。
  const supabase = createAdminClient() as unknown as SupabaseClient | null;
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const state = await readReactionState(supabase, id, visitorKey);
  return NextResponse.json(state);
}

export async function POST(req: Request, { params }: Params) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "story-reactions",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { visitorKey?: unknown };
  const visitorKey = normalizeVisitorKey(body.visitorKey);
  if (!visitorKey) {
    return NextResponse.json({ error: "visitorKey が必要です" }, { status: 400 });
  }

  const supabase = createAdminClient() as unknown as SupabaseClient | null;
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // 既存判定 → トグル（あれば削除 / なければ挿入）
  const { data: existing } = await supabase
    .from("content_reactions")
    .select("id")
    .eq("vendor_content_id", id)
    .eq("visitor_key", visitorKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("content_reactions")
      .delete()
      .eq("vendor_content_id", id)
      .eq("visitor_key", visitorKey);
    if (error) {
      return NextResponse.json({ error: "リアクションの更新に失敗しました" }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("content_reactions")
      .insert({ vendor_content_id: id, visitor_key: visitorKey });
    // unique 制約違反（同時押しで二重 insert）は「既に押されている」とみなして無視する
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: "リアクションの更新に失敗しました" }, { status: 500 });
    }
  }

  const state = await readReactionState(supabase, id, visitorKey);
  return NextResponse.json(state);
}
