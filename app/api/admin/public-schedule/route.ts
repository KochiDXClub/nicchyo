import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { readScheduleData } from "@/lib/market-schedule/read.server";
import { publicScheduleReadiness } from "@/lib/market-schedule/readiness";
import { nextSundayJstString } from "@/lib/time/jstDate";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";
import { revalidatePublicScheduleRollout } from "@/lib/market-schedule/rollout.server";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const db = auth.adminClient as unknown as SupabaseClient;
  try {
    const [{ data, error }, schedule] = await Promise.all([
      db.from("public_schedule_rollout").select("enabled,revision").eq("id", true).single(),
      readScheduleData(db),
    ]);
    if (error || !data) return NextResponse.json({ error: "公開設定を取得できませんでした" }, { status: 500, headers: privateNoStoreHeaders() });
    const summary = publicScheduleReadiness(schedule, nextSundayJstString());
    return NextResponse.json({ ...data, summary }, { headers: privateNoStoreHeaders() });
  } catch { return NextResponse.json({ error: "公開設定を取得できませんでした" }, { status: 500, headers: privateNoStoreHeaders() }); }
}
export async function POST(request: Request) {
  const guard = await guardAdminWrite(request, { bucket: "admin-public-schedule", limit: 20, json: true });
  if ("error" in guard) return guard.error;
  const body = guard.body as Record<string, unknown> | null;
  if (!body || typeof body.enabled !== "boolean" || !Number.isInteger(body.revision) || (body.revision as number) < 1 || body.confirmed !== true) return NextResponse.json({ error: "公開設定を確認してください" }, { status: 400 });
  const db = guard.ctx.adminClient as unknown as SupabaseClient;
  if (body.enabled) {
    try {
      const readiness = publicScheduleReadiness(await readScheduleData(db), nextSundayJstString());
      if (readiness.conflicts > 0) return NextResponse.json({ error: "今後６週間の予定に競合があります。先に出店予定管理で解消してください。" }, { status: 409 });
    } catch { return NextResponse.json({ error: "公開前の予定を確認できませんでした" }, { status: 500 }); }
  }
  const { data, error } = await db.rpc("set_public_schedule_rollout", { p_enabled: body.enabled, p_expected: body.revision, p_actor: guard.ctx.user.id });
  if (error) return NextResponse.json({ error: "公開設定を保存できませんでした" }, { status: 500 });
  const status = (data as { status?: string } | null)?.status;
  if (status !== "ok") return NextResponse.json({ error: status === "stale" ? "別の画面で更新されました。再読み込みしてください。" : status === "no_rules" ? "出店予定を登録してから公開してください。" : status === "irreversible" ? "公開開始後は旧番号の表示に戻せません。必要な場合はマップの公開設定を変更してください。" : "公開設定を確認してください" }, { status: 409 });
  await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, { action: "public_schedule_rollout", targetType: "public_schedule", details: JSON.stringify({ enabled: body.enabled }), ipAddress: guard.ctx.ip });
  revalidatePublicShops();
  revalidatePublicScheduleRollout();
  return NextResponse.json({ ok: true });
}
