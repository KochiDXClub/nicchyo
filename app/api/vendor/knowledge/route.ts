import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";
import { requestEmbeddings } from "@/lib/ai/openaiFetch";

const MAX_CONTENT_LENGTH = 5000;
/** 旧画面の自由メモ。20261001160000 で既存のメモに付けた題と同じ */
const LEGACY_MEMO_TITLE = "お店のメモ";
const KnowledgeBodySchema = z.object({
  content: z.string().trim().min(1, "content is required").max(MAX_CONTENT_LENGTH, `内容は${MAX_CONTENT_LENGTH}文字以内で入力してください`),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET: 既存の知識を取得 ───────────────────────────────────
export async function GET() {
  try {
    const auth = await requireVendorContext({ permission: "ai_notes" });
    if (!auth.ok) return auth.response;
    const { vendorId, supabase } = auth;

    // 旧画面（自由メモ1枚）は「お店のメモ」の1枚だけを読み書きする。
    // ノートの束（/api/vendor/ai-notes）で足したほかのノートには触らない
    const { data } = await supabase
      .from("store_knowledge")
      .select("id, content, created_at, updated_at")
      .eq("store_id", vendorId)
      .eq("title", LEGACY_MEMO_TITLE)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ knowledge: data ?? null });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// ─── POST: 知識を保存（embedding生成 → DB保存） ────────────────
export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "vendor-knowledge-post",
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireVendorContext({ permission: "ai_notes" });
    if (!auth.ok) return auth.response;
    const { vendorId } = auth;

    const parsed = KnowledgeBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { content } = parsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // embedding生成
    let embedding: number[] | null = null;
    if (openaiKey) {
      const embeddingRes = await requestEmbeddings(openaiKey, content.trim());
      if (embeddingRes.ok) {
        const payload = (await embeddingRes.json()) as { data?: { embedding: number[] }[] };
        embedding = payload.data?.[0]?.embedding ?? null;
      }
    }

    // サービスロールで保存（RLS回避）
    const serviceClient = createServiceClient(supabaseUrl!, serviceRoleKey!);

    // 既存レコードがあれば更新、なければ挿入
    const { data: existing } = await serviceClient
      .from("store_knowledge")
      .select("id")
      .eq("store_id", vendorId)
      .eq("title", LEGACY_MEMO_TITLE)
      .limit(1)
      .single();

    if (existing?.id) {
      await serviceClient
        .from("store_knowledge")
        .update({ content: content.trim(), embedding, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await serviceClient
        .from("store_knowledge")
        .insert({ store_id: vendorId, title: LEGACY_MEMO_TITLE, content: content.trim(), embedding });
    }

    return NextResponse.json({ ok: true, hasEmbedding: embedding !== null });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
