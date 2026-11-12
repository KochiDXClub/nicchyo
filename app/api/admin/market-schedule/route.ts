import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";
import { readScheduleData } from "@/lib/market-schedule/read.server";
import { isMarketDate } from "@/lib/market-schedule/calendar";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const db = auth.adminClient as unknown as SupabaseClient;
    const vendorId = new URL(request.url).searchParams.get("vendor");
    if (vendorId !== null && !UUID_RE.test(vendorId)) return NextResponse.json({ error: "店舗IDを確認してください" }, { status: 400 });
    const data = await readScheduleData(db, vendorId ?? undefined);
    return NextResponse.json(data, { headers: privateNoStoreHeaders() });
  } catch { return NextResponse.json({ error: "出店予定を取得できませんでした" }, { status: 500 }); }
}

const date = isMarketDate;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
const optionalDate = (value: unknown): value is string | null => value === null || date(value);

export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-market-schedule", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const body = guard.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
    const db = guard.ctx.adminClient as unknown as SupabaseClient;
    let call: string;
    let args: Record<string, unknown>;
    if (body.action === "addMembership" && uuid(body.locationId) && uuid(body.vendorId) && date(body.start) && typeof body.confirmed === "boolean" && (body.seenCount === null || (Number.isInteger(body.seenCount) && (body.seenCount as number) >= 0))) {
      call = "add_market_place_membership"; args = { p_location: body.locationId, p_vendor: body.vendorId, p_start: body.start, p_confirm: body.confirmed, p_seen_count: body.seenCount };
    } else if (body.action === "endMembership" && uuid(body.membershipId) && date(body.end) && date(body.expectedStart)) {
      call = "end_market_place_membership"; args = { p_membership: body.membershipId, p_end: body.end, p_expected_start: body.expectedStart };
    } else if (body.action === "addRule" && uuid(body.membershipId) && ["weekly", "fortnightly", "monthly"].includes(String(body.cadence)) && date(body.start) && optionalDate(body.end) && optionalDate(body.anchor) && (body.weeks === null || (Array.isArray(body.weeks) && body.weeks.length <= 5 && body.weeks.every((n) => Number.isInteger(n) && n >= 1 && n <= 5)))) {
      call = "add_market_schedule_rule"; args = { p_membership: body.membershipId, p_cadence: body.cadence, p_start: body.start, p_end: body.end, p_anchor: body.anchor, p_weeks: body.weeks };
    } else if (body.action === "endRule" && uuid(body.ruleId) && date(body.end) && optionalDate(body.expectedEnd)) {
      call = "end_market_schedule_rule"; args = { p_rule: body.ruleId, p_end: body.end, p_expected_end: body.expectedEnd };
    } else if (body.action === "voidRule" && uuid(body.ruleId) && optionalDate(body.expectedEnd)) {
      call = "void_market_schedule_rule"; args = { p_rule: body.ruleId, p_expected_end: body.expectedEnd };
    } else if (body.action === "override" && uuid(body.locationId) && date(body.date) && (body.membershipId === null || uuid(body.membershipId)) && (body.mode === "set" || body.mode === "clear") && (body.expected === null || (Number.isSafeInteger(body.expected) && (body.expected as number) > 0))) {
      call = "set_market_place_override"; args = { p_location: body.locationId, p_date: body.date, p_membership: body.membershipId, p_action: body.mode, p_expected: body.expected };
    } else return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
    const { data, error } = await db.rpc(call, args);
    if (error) return NextResponse.json({ error: "出店予定を保存できませんでした" }, { status: 500 });
    const result = data as { status: string; count?: number };
    if (result.status === "confirmation_required") return NextResponse.json({ error: "この場所には別の店舗も登録されています。同じ場所に登録しますか？", needsConfirmation: true, count: result.count }, { status: 409 });
    if (result.status !== "ok") return NextResponse.json({ error: result.status === "stale" || result.status === "stale_confirmation" ? "別の画面で更新されました。読み直してから操作してください。" : result.status === "period_overlap" ? "この店舗はその期間にすでに登録されています。" : result.status === "membership_inactive" ? "その日はこの場所に登録されていません。" : "入力内容または登録期間を確認してください。" }, { status: 409 });
    await logAdminAudit(guard.ctx.adminClient, { id: guard.ctx.user.id, email: guard.ctx.user.email, role: guard.ctx.role }, { action: "market_schedule_edit", targetType: "market_schedule", targetId: typeof body.locationId === "string" ? body.locationId : typeof body.membershipId === "string" ? body.membershipId : null, details: JSON.stringify({ action: body.action, ...args }), ipAddress: guard.ctx.ip });
    revalidatePublicShops();
    return NextResponse.json({ ok: true, ...result });
  } catch { return NextResponse.json({ error: "出店予定を保存できませんでした" }, { status: 500 }); }
}
