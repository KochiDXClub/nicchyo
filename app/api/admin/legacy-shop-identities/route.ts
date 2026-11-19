import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { readScheduleRows } from "@/lib/market-schedule/read.server";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const db = auth.adminClient as unknown as SupabaseClient;
    const [candidates, aliases, revocations, vendors] = await Promise.all([
      readScheduleRows(db, "legacy_shop_identity_candidates", "legacy_shop_id,vendor_ids,candidate_count", ["legacy_shop_id"]),
      readScheduleRows(db, "legacy_shop_identity_aliases", "legacy_shop_id,vendor_id,confirmed_at,evidence", ["legacy_shop_id"]),
      readScheduleRows(db, "legacy_shop_identity_revocations", "legacy_shop_id,reason,revoked_at", ["legacy_shop_id"]),
      readScheduleRows(db, "vendors", "id,shop_name,public_shop_id", ["id"]),
    ]);
    return NextResponse.json({ candidates, aliases, revocations, vendors }, { headers: privateNoStoreHeaders() });
  } catch {
    return NextResponse.json({ error: "旧番号の確認情報を取得できませんでした" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-legacy-shop-identities", limit: 40, json: true });
    if ("error" in guard) return guard.error;
    const input = guard.body as Record<string, unknown> | null;
    const legacyId = input?.legacyId;
    const vendorId = input?.vendorId;
    const evidence = typeof input?.evidence === "string" ? input.evidence.trim() : "";
    if (input?.action === "revoke") {
      if (!Number.isInteger(legacyId) || (legacyId as number) < 1 || (legacyId as number) > 999 || evidence.length < 10 || evidence.length > 1000 || input.confirmed !== true) return NextResponse.json({ error: "番号と取消理由を確認してください" }, { status: 400 });
      const db = guard.ctx.adminClient as unknown as SupabaseClient;
      const { error } = await db.from("legacy_shop_identity_revocations").insert({ legacy_shop_id: legacyId, revoked_by: guard.ctx.user.id, reason: evidence });
      if (error?.code === "23505" || error?.code === "23503") return NextResponse.json({ error: "対象がないか、すでに取り消されています。再読み込みしてください。" }, { status: 409 });
      if (error) return NextResponse.json({ error: "対応を取り消せませんでした" }, { status: 500 });
      await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, { action: "legacy_shop_identity_revoke", targetType: "legacy_shop", targetId: String(legacyId), ipAddress: guard.ctx.ip });
      return NextResponse.json({ ok: true });
    }
    if (!Number.isInteger(legacyId) || (legacyId as number) < 1 || (legacyId as number) > 999 || typeof vendorId !== "string" || !UUID_RE.test(vendorId) || evidence.length < 10 || evidence.length > 1000 || input?.confirmed !== true) {
      return NextResponse.json({ error: "番号、店舗と確認した根拠を入力してください" }, { status: 400 });
    }
    const db = guard.ctx.adminClient as unknown as SupabaseClient;
    const { data: candidate, error: candidateError } = await db.from("legacy_shop_identity_candidates").select("vendor_ids,candidate_count").eq("legacy_shop_id", legacyId).maybeSingle();
    if (candidateError) return NextResponse.json({ error: "配置履歴を確認できませんでした" }, { status: 503 });
    if (candidate && (Number(candidate.candidate_count) > 1 || !Array.isArray(candidate.vendor_ids) || !candidate.vendor_ids.includes(vendorId))) return NextResponse.json({ error: "履歴が複数あるか、選択した店舗と一致しません。自動移行の対象にはできません。" }, { status: 409 });
    const { error } = await db.from("legacy_shop_identity_aliases").insert({ legacy_shop_id: legacyId, vendor_id: vendorId, confirmed_by: guard.ctx.user.id, evidence });
    if (error?.code === "23505") return NextResponse.json({ error: "この番号はすでに確定しています。画面を再読み込みしてください。" }, { status: 409 });
    if (error?.code === "23503") return NextResponse.json({ error: "店舗が見つかりません。画面を再読み込みしてください。" }, { status: 409 });
    if (error) return NextResponse.json({ error: "旧番号を確定できませんでした" }, { status: 500 });
    await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, { action: "legacy_shop_identity_confirm", targetType: "vendor", targetId: vendorId, details: JSON.stringify({ legacyId }), ipAddress: guard.ctx.ip });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "旧番号を確定できませんでした" }, { status: 500 });
  }
}
