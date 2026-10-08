import crypto from "crypto";
import { isSecretTokenPath } from "@/lib/analytics/secretPaths";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { todayJstString } from "@/lib/time/jstDate";
import { createAdminClient } from "@/lib/supabase/adminClient";

const VISITOR_COOKIE_NAME = "nicchyo_visitor_id";
// 通常のパス＋クエリは収まる長さ。超えるものは記録せず捨てる（DB 肥大の防止）
const MAX_PATH_LENGTH = 512;

function isValidVisitorKey(value: string) {
  return value.length >= 16 && value.length <= 128;
}

function normalizeRole(user: unknown) {
  if (!user || typeof user !== "object") return null;
  const record = user as {
    app_metadata?: { role?: string };
    user_metadata?: { role?: string };
  };
  return record.app_metadata?.role ?? record.user_metadata?.role ?? null;
}

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

async function countDailyVisitor(visitDate: string, visitorKey: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("track_home_visit", {
    p_visit_date: visitDate,
    p_visitor_key: visitorKey,
  });
  if (error) console.warn("[page-visit] 日次訪問者数の記録に失敗しました:", error.message);
}

export async function POST(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  // 認証不要でだれでも叩ける書き込みAPI。同一オリジン要求でもボットや壊れた
  // クライアントの連打はありえるため、IPあたりで上限を設ける（Issue #352）
  const rateLimited = await enforceRateLimit(request, {
    bucket: "analytics-page-visit-post",
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let visitorKey = cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "";
  let shouldSetVisitorCookie = false;

  if (!isValidVisitorKey(visitorKey)) {
    visitorKey = crypto.randomUUID();
    shouldSetVisitorCookie = true;
  }

  const body = (await request.json().catch(() => null)) as {
    path?: string;
    durationSeconds?: number;
  } | null;

  const path = typeof body?.path === "string" ? body.path.trim() : "";
  const durationSeconds = Math.max(
    0,
    Math.min(86400, Math.round(typeof body?.durationSeconds === "number" ? body.durationSeconds : 0))
  );

  if (path.length > MAX_PATH_LENGTH || !path.startsWith("/") || path.startsWith("/api") || isSecretTokenPath(path) || durationSeconds <= 0) {
    const skippedResponse = NextResponse.json({ ok: true, skipped: true });
    if (shouldSetVisitorCookie) {
      skippedResponse.cookies.set(VISITOR_COOKIE_NAME, visitorKey, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return skippedResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const visitDate = todayJstString();
  const { error } = await supabase.from("web_page_analytics").insert({
    visit_date: visitDate,
    visitor_key: visitorKey,
    path,
    duration_seconds: durationSeconds,
    user_role: normalizeRole(user),
  });

  // 「今週の訪問者」（web_visitor_stats）は来訪者全体のページ訪問から数える。
  // 管理者の閲覧は web_page_daily_summaries と同じく数えない。
  // track_home_visit は同じ日・同じ visitor を1回しか数えない（失敗しても記録は妨げない）
  if (!error && !ADMIN_ROLES.has(normalizeRole(user) ?? "")) {
    await countDailyVisitor(visitDate, visitorKey);
  }

  const response = NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
  if (shouldSetVisitorCookie) {
    response.cookies.set(VISITOR_COOKIE_NAME, visitorKey, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}
