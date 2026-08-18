import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

export async function POST(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

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

  if (!path.startsWith("/") || path.startsWith("/api") || durationSeconds <= 0) {
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

  const visitDate = getTokyoTodayIso();
  const { error } = await supabase.from("web_page_analytics").insert({
    visit_date: visitDate,
    visitor_key: visitorKey,
    path,
    duration_seconds: durationSeconds,
    user_role: normalizeRole(user),
  });

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
