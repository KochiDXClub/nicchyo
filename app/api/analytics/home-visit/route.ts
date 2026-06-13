import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { requireSameOrigin } from "@/lib/security/requestGuards";

const VISITOR_COOKIE_NAME = "nicchyo_visitor_id";

function getTokyoTodayIso(baseDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(baseDate);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isValidVisitorKey(value: string) {
  return /^[a-f0-9-]{16,64}$/i.test(value);
}

// 同一visitor_keyからの連続呼び出しを防ぐ（1分以内は無視）
const homeVisitCooldown = new Map<string, number>();
const HOME_VISIT_COOLDOWN_MS = 60 * 1000;

export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const cookieStore = await cookies();
  let visitorKey = cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? "";
  let shouldSetVisitorCookie = false;
  if (!isValidVisitorKey(visitorKey)) {
    visitorKey = crypto.randomUUID();
    shouldSetVisitorCookie = true;
  }

  // クールダウンチェック
  const now = Date.now();
  const lastCall = homeVisitCooldown.get(visitorKey);
  if (lastCall && now - lastCall < HOME_VISIT_COOLDOWN_MS) {
    const skipped = NextResponse.json({ ok: true, skipped: true, reason: "cooldown" });
    return skipped;
  }
  homeVisitCooldown.set(visitorKey, now);
  // メモリリーク防止: 1000件超えたら古いものを削除
  if (homeVisitCooldown.size > 1000) {
    const oldest = Array.from(homeVisitCooldown.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 200);
    oldest.forEach(([k]) => homeVisitCooldown.delete(k));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const skippedResponse = NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: "supabase_env_missing",
      },
      { status: 503 }
    );
    if (shouldSetVisitorCookie) {
      skippedResponse.cookies.set(VISITOR_COOKIE_NAME, visitorKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365 * 2,
        path: "/",
      });
    }
    return skippedResponse;
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const visitDate = getTokyoTodayIso();

  const { data, error } = await supabase.rpc("track_home_visit", {
    p_visit_date: visitDate,
    p_visitor_key: visitorKey,
  });

  if (error) {
    const errorResponse = NextResponse.json(
      {
        ok: false,
        error: "track_home_visit_failed",
      },
      { status: 500 }
    );
    if (shouldSetVisitorCookie) {
      errorResponse.cookies.set(VISITOR_COOKIE_NAME, visitorKey, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365 * 2,
        path: "/",
      });
    }
    return errorResponse;
  }

  const successResponse = NextResponse.json({
    ok: true,
    counted: Boolean(data),
    visitDate,
  });
  if (shouldSetVisitorCookie) {
    successResponse.cookies.set(VISITOR_COOKIE_NAME, visitorKey, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/",
    });
  }
  return successResponse;
}
