import { NextRequest, NextResponse } from "next/server";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { noStoreHeaders } from "@/lib/http/cacheHeaders";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { DEFAULT_SITE_COPY, parseSiteCopy, resolveSiteCopy } from "@/lib/site-copy/content";
import { revalidateSiteCopy } from "@/lib/site-copy/server";

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
    // 同一オリジン → 管理者 → 回数制限（管理者ごと）の順。運営の書き込み API と同じ入口を使う
    const guard = await guardAdminWrite(request, { bucket: "admin-site-copy", limit: 30 });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient } = guard.ctx;
    if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) return NextResponse.json({ error: "内容が大きすぎます" }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 1_000_000) return NextResponse.json({ error: "内容が大きすぎます" }, { status: 413 });
    const body = JSON.parse(raw) as { content?: unknown; revision?: unknown; publish?: unknown };
    const content = parseSiteCopy(body.content);
    if (!content || !Number.isSafeInteger(body.revision) || (body.revision as number) < 0 || typeof body.publish !== "boolean") {
      return NextResponse.json({ error: "文言を確認してください。空欄・HTML・長すぎる文章は保存できません。" }, { status: 400 });
    }
    const db = adminClient as unknown as NonNullable<ReturnType<typeof createAdminClient>>;
    const { data, error } = await db.rpc("save_site_copy", { p_content: content, p_expected_revision: body.revision, p_publish: body.publish, p_actor: user.id });
    if (error?.message?.includes("site_copy_conflict")) return NextResponse.json({ error: "別の管理者が更新しました。再読み込みしてから編集してください。" }, { status: 409 });
    if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });

    // 下書き保存も公開も、誰がいつ何をしたか監査ログに残す（ほかの管理 API と同じ）
    await logAdminAudit(db as unknown as Parameters<typeof logAdminAudit>[0], { id: user.id, email: user.email, role }, {
      action: body.publish ? "site_copy_publish" : "site_copy_draft_save",
      targetType: "site_copy",
      targetId: "1",
      details: JSON.stringify({ revision: data }),
    });
    // 公開したときだけ、共通の文言キャッシュを捨てる（下書き保存は来訪者の表示を変えない）
    if (body.publish) revalidateSiteCopy();
    return NextResponse.json({ revision: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "入力を読み取れませんでした" : "保存できませんでした" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
