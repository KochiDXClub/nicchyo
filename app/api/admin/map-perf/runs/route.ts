import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import { computeMetrics } from "@/lib/perf/metrics";
import type { BenchmarkReport } from "@/lib/perf/mapBenchmark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * マップ描画の計測結果ログ
 *
 * GET    /api/admin/map-perf/runs?branch=&limit=   一覧（指標は計算済み、生レポートは含まない）
 * GET    /api/admin/map-perf/runs?id=              1 件（生レポート付き）
 * POST   /api/admin/map-perf/runs                  保存
 * DELETE /api/admin/map-perf/runs?id=              削除
 *
 * 管理者のみ。RLS でも守っているが、書き込みは service role で行うので API 側でも必ず確認する。
 */

const MAX_LIMIT = 500;
const MAX_REPORT_BYTES = 512 * 1024;

export interface MapPerfRunRow {
  id: string;
  created_at: string;
  label: string;
  branch: string;
  commit_sha: string;
  environment: string;
  deployment_url: string;
  viewport_width: number;
  viewport_height: number;
  device_pixel_ratio: number;
  shop_count: number;
  cpu_throttle: number;
  user_agent: string;
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role env vars are missing.");
  }
  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function isReport(v: unknown): v is BenchmarkReport {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<BenchmarkReport>;
  return (
    typeof r.ranAt === "string" &&
    !!r.dom &&
    Array.isArray(r.zoomSteps) &&
    !!r.pan &&
    !!r.highlight &&
    !!r.idle
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const id = request.nextUrl.searchParams.get("id");
  const supabase = createAdminClient();

  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const { data, error } = await supabase.from("map_perf_runs").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      run: { ...data, metrics: computeMetrics(data.report as BenchmarkReport) },
    });
  }

  const branch = request.nextUrl.searchParams.get("branch");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 200)
  );

  let query = supabase
    .from("map_perf_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (branch) query = query.eq("branch", branch);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load runs" }, { status: 500 });

  const runs = (data ?? []).map((row) => {
    const { report, ...rest } = row as MapPerfRunRow & { report: unknown };
    return {
      ...rest,
      metrics: isReport(report) ? computeMetrics(report) : null,
    };
  });
  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "admin-map-perf-save",
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  // パース前にサイズを見る（巨大 body でメモリを使わせない）
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REPORT_BYTES * 2) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const report = body.report;
  if (!isReport(report)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  if (JSON.stringify(report).length > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: "Report too large" }, { status: 413 });
  }

  const row = {
    created_by: auth.user.id,
    label: str(body.label, 200),
    branch: str(body.branch, 200),
    commit_sha: str(body.commitSha, 64),
    environment: str(body.environment, 32, "unknown"),
    deployment_url: str(body.deploymentUrl, 500),
    viewport_width: Math.round(num(body.viewportWidth, report.viewport?.width ?? 0)),
    viewport_height: Math.round(num(body.viewportHeight, report.viewport?.height ?? 0)),
    device_pixel_ratio: num(body.devicePixelRatio, report.viewport?.dpr ?? 1),
    shop_count: Math.round(num(body.shopCount, 0)),
    cpu_throttle: num(body.cpuThrottle, 1),
    user_agent: str(body.userAgent, 500, report.userAgent ?? ""),
    report,
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("map_perf_runs").insert(row).select("id").single();
  if (error || !data) {
    return NextResponse.json({ error: "Failed to save run" }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

export async function DELETE(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("map_perf_runs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete run" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
