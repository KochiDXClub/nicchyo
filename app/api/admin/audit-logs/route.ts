import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole } from "@/lib/auth/permissions";
import { authorizeAdmin } from "@/lib/auth/requireAdminApi";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { todayJstString } from "@/lib/time/jstDate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AuditLogPayload = {
  action: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  details?: string;
};

/** 期間の絞り込み。today は日本時間のきょう0時から、week / month は今から7日・30日さかのぼる */
export const AUDIT_LOG_PERIODS = ["all", "today", "week", "month"] as const;
export type AuditLogPeriod = (typeof AUDIT_LOG_PERIODS)[number];

/** ロールの絞り込み。管理者には super_admin も含める */
const ROLE_VALUES = {
  admin: ["admin", "super_admin"],
  moderator: ["moderator"],
} as const;
export const AUDIT_LOG_ROLE_FILTERS = ["all", "admin", "moderator"] as const;
export type AuditLogRoleFilter = (typeof AUDIT_LOG_ROLE_FILTERS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

function periodStart(period: AuditLogPeriod, now: Date): string | null {
  if (period === "today") return `${todayJstString(now)}T00:00:00+09:00`;
  if (period === "week") return new Date(now.getTime() - 7 * DAY_MS).toISOString();
  if (period === "month") return new Date(now.getTime() - 30 * DAY_MS).toISOString();
  return null;
}

export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-audit-logs-post",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  // 監査ログは admin だけが読み書きする（RLS の audit_logs_select_admin と同じ範囲）
  const { user, error: authError } = await authorizeAdmin();
  if (!user) return NextResponse.json({ error: authError }, { status: 403 });
  const role = getRole(user);

  const body = (await req.json().catch(() => null)) as AuditLogPayload | null;
  if (!body || typeof body.action !== "string" || !body.action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

  const dc = createAdminClient();
  if (!dc) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: role,
    action: body.action,
    target_type: body.target_type ?? null,
    target_id: body.target_id ?? null,
    target_name: body.target_name ?? null,
    details: body.details ?? null,
    ip_address: ip,
  });

  if (error) {
    console.error("[admin/audit-logs] insert failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  const { user, error: authError } = await authorizeAdmin();
  if (!user) return NextResponse.json({ error: authError }, { status: 403 });

  const url = new URL(req.url);
  const parsedLimit = parseInt(url.searchParams.get("limit") ?? "500", 10);
  const limit = Number.isNaN(parsedLimit) ? 500 : Math.min(Math.max(parsedLimit, 1), 1000);

  const period = (url.searchParams.get("period") ?? "all") as AuditLogPeriod;
  const role = (url.searchParams.get("role") ?? "all") as AuditLogRoleFilter;
  if (!AUDIT_LOG_PERIODS.includes(period) || !AUDIT_LOG_ROLE_FILTERS.includes(role)) {
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  }

  const dc = createAdminClient();
  if (!dc) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // 期間・ロールは DB で絞る（読み込んだ分だけを画面で絞ると、上限より古い記録が出てこないため）
  const since = periodStart(period, new Date());
  let query = dc.from("admin_audit_logs").select("*", { count: "exact" });
  if (since) query = query.gte("created_at", since);
  if (role !== "all") query = query.in("actor_role", [...ROLE_VALUES[role]]);

  // 件数のまとめは絞り込みに関係なく、全体から数える
  const countAll = () => dc.from("admin_audit_logs").select("id", { count: "exact", head: true });
  const [list, all, today, admins, moderators] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(limit),
    countAll(),
    countAll().gte("created_at", periodStart("today", new Date())!),
    countAll().in("actor_role", [...ROLE_VALUES.admin]),
    countAll().in("actor_role", [...ROLE_VALUES.moderator]),
  ]);

  const error = list.error ?? all.error ?? today.error ?? admins.error ?? moderators.error;
  if (error) {
    console.error("[admin/audit-logs] select failed:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({
    logs: list.data,
    total: list.count ?? 0,
    stats: {
      total: all.count ?? 0,
      today: today.count ?? 0,
      admin: admins.count ?? 0,
      moderator: moderators.count ?? 0,
    },
  });
}
