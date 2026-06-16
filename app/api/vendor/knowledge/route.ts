import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireVendorRole } from "@/lib/auth/permissions";

const MAX_CONTENT_LENGTH = 5000;
const KnowledgeBodySchema = z.object({
  content: z.string().trim().min(1, "content is required").max(MAX_CONTENT_LENGTH, `内容は${MAX_CONTENT_LENGTH}文字以内で入力してください`),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── GET: 既存の知識を取得 ───────────────────────────────────
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const forbidden = requireVendorRole(user);
    if (forbidden) return forbidden;

    const { data } = await supabase
      .from("store_knowledge")
      .select("id, content, created_at, updated_at")
      .eq("store_id", user.id)
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

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const forbidden = requireVendorRole(user);
    if (forbidden) return forbidden;

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
      const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "text-embedding-3-small", input: content.trim() }),
      });
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
      .eq("store_id", user.id)
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
        .insert({ store_id: user.id, content: content.trim(), embedding });
    }

    return NextResponse.json({ ok: true, hasEmbedding: embedding !== null });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
