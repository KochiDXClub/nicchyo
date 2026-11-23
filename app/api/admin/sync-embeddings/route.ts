import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, type AdminApiContext } from "@/lib/auth/requireAdminApi";
import { verifyBearerSecret } from "@/lib/security/cronAuth";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import type { EmbeddingSyncRunRow } from "@/types/database.extensions";
import { syncKnowledgeEmbeddings, syncVendorEmbeddings } from "./_sync";
import { embeddingSyncClient } from "./_history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Target = EmbeddingSyncRunRow["target"];
type Source = EmbeddingSyncRunRow["source"];

async function runSync(target: Target, source: Source, auth?: AdminApiContext) {
  try {
    const supabase = embeddingSyncClient(auth?.adminClient);
    const { data: run, error: startError } = await supabase.rpc("begin_embedding_sync", {
      p_target: target,
      p_source: source,
      p_actor_id: auth?.user.id ?? null,
    }).single();
    if (startError?.code === "23505") {
      return NextResponse.json({ ok: false, error: "Already running" }, { status: 409 });
    }
    if (startError) throw startError;

    let processed = 0;
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY is missing.");
      const sync = target === "vendors" ? syncVendorEmbeddings : syncKnowledgeEmbeddings;
      const signal = AbortSignal.timeout(270_000);
      await sync({ supabase, apiKey, runId: run.id, signal, recordProcessed: (count) => { processed += count; } });
      signal.throwIfAborted();

      const { data: published, error } = await supabase.rpc("finish_embedding_sync", {
        p_run_id: run.id,
        p_succeeded: true,
        p_processed_count: processed,
      }).single();
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        processed,
        startedAt: run.started_at,
        finishedAt: published.finished_at,
        version: published.version_number,
      });
    } catch (error) {
      const { error: finishError } = await supabase.rpc("finish_embedding_sync", {
        p_run_id: run.id,
        p_succeeded: false,
        p_processed_count: processed,
      }).single();
      console.error("[sync-embeddings] run failed", { runId: run.id, target, error, finishError });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  } catch (error) {
    console.error("[sync-embeddings] run history unavailable", { target, error });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

function hasSyncSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return !!secret && verifyBearerSecret(req.headers.get("authorization"), secret);
}

export async function GET(req: NextRequest) {
  if (!hasSyncSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runSync("vendors", "scheduled");
}

export async function POST(req: NextRequest) {
  const isScript = req.headers.has("authorization");
  if (isScript && !hasSyncSecret(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let auth: AdminApiContext | undefined;
  if (!isScript) {
    const result = await requireAdminApi();
    if ("error" in result) return result.error;
    const origin = requireSameOrigin(req);
    if (!origin.ok) return origin.response;
    auth = result;
  }

  // 既存の本文なし POST は店舗更新。
  let target: Target = "vendors";
  if (req.body) {
    const body = await req.json().catch(() => null);
    if (body?.target !== "vendors" && body?.target !== "knowledge") {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    target = body.target;
  }
  return runSync(target, isScript ? "script" : "manual", auth);
}
