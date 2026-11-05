import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { noStoreHeaders } from "@/lib/http/cacheHeaders";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { DEFAULT_SITE_COPY, parseSiteCopy, resolveSiteCopy } from "@/lib/site-copy/content";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const db = auth.adminClient as unknown as NonNullable<ReturnType<typeof createAdminClient>>;
    const [state, history] = await Promise.all([
      db.from("site_copy_state").select("draft,published,revision,updated_at").eq("id", 1).single(),
      db.from("site_copy_history").select("id,content,published_at,published_by").order("id", { ascending: false }).limit(30),
    ]);
    if (state.error || history.error) return NextResponse.json({ error: "文言を読み込めませんでした" }, { status: 503 });
    const draft = state.data.draft ? resolveSiteCopy(state.data.draft) : null;
    const published = state.data.published ? resolveSiteCopy(state.data.published) : null;
    if ((state.data.draft && !draft) || (state.data.published && !published)) {
      return NextResponse.json({ error: "保存済みの文言を読み取れません。管理者に確認してください。" }, { status: 503 });
    }
    return NextResponse.json({
      draft: draft ?? published ?? DEFAULT_SITE_COPY,
      published: published ?? DEFAULT_SITE_COPY,
      revision: state.data.revision,
      history: (history.data ?? []).map((item) => ({ ...item, content: resolveSiteCopy(item.content) })).filter((item) => item.content),
    }, { headers: noStoreHeaders() });
  } catch { return NextResponse.json({ error: "文言を読み込めませんでした" }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  try {
    const origin = requireSameOrigin(request);
    if (!origin.ok) return origin.response;
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const limit = await enforceRateLimit(request, { bucket: "admin-site-copy", limit: 30, windowMs: 10 * 60 * 1000 });
    if (limit) return limit;
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return NextResponse.json({ error: "内容が大きすぎます" }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 1_000_000) return NextResponse.json({ error: "内容が大きすぎます" }, { status: 413 });
    const body = JSON.parse(raw) as { content?: unknown; revision?: unknown; publish?: unknown };
    const content = parseSiteCopy(body.content);
    if (!content || !Number.isSafeInteger(body.revision) || (body.revision as number) < 0 || typeof body.publish !== "boolean") {
      return NextResponse.json({ error: "文言を確認してください。空欄・HTML・長すぎる文章は保存できません。" }, { status: 400 });
    }
    const db = auth.adminClient as unknown as NonNullable<ReturnType<typeof createAdminClient>>;
    const { data, error } = await db.rpc("save_site_copy", { p_content: content, p_expected_revision: body.revision, p_publish: body.publish, p_actor: auth.user.id });
    if (error?.message?.includes("site_copy_conflict")) return NextResponse.json({ error: "別の管理者が更新しました。再読み込みしてから編集してください。" }, { status: 409 });
    if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
    return NextResponse.json({ revision: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "入力を読み取れませんでした" : "保存できませんでした" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
