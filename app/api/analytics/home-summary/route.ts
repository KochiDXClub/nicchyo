import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

type VendorRow = {
  category_id: string | null;
};

type LocationRow = {
  district: string | null;
};

type VisitorRow = {
  visit_date: string;
  visitor_count: number | null;
};

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

function getWeekStartIso(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "analytics-home-summary",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "supabase_env_missing" },
      { status: 503 }
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const todayIso = getTokyoTodayIso();
  const weekStartIso = getWeekStartIso(todayIso);

  const [
    { data: vendorsData, error: vendorsError },
    { data: locationsData, error: locationsError },
    { data: weeklyVisitorsData, error: weeklyVisitorsError },
  ] = await Promise.all([
    supabase.from("vendors").select("category_id"),
    supabase.from("market_locations").select("district"),
    supabase
      .from("web_visitor_stats")
      .select("visit_date, visitor_count")
      .gte("visit_date", weekStartIso)
      .lte("visit_date", todayIso),
  ]);

  if (vendorsError || locationsError || weeklyVisitorsError) {
    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
      },
      { status: 500 }
    );
  }

  const vendors = Array.isArray(vendorsData) ? (vendorsData as VendorRow[]) : [];
  const locations = Array.isArray(locationsData) ? (locationsData as LocationRow[]) : [];
  const weeklyVisitors = Array.isArray(weeklyVisitorsData)
    ? (weeklyVisitorsData as VisitorRow[])
    : [];

  const categoryCount = new Set(
    vendors
      .map((vendor) => vendor.category_id)
      .filter((categoryId): categoryId is string => typeof categoryId === "string" && categoryId.length > 0)
  ).size;

  const areaCount = new Set(
    locations
      .map((location) => location.district?.trim())
      .filter((district): district is string => typeof district === "string" && district.length > 0)
  ).size;

  const weeklyVisitorTotal = weeklyVisitors.reduce(
    (sum, row) => sum + (typeof row.visitor_count === "number" ? row.visitor_count : 0),
    0
  );

  return NextResponse.json(
    { ok: true, categoryCount, areaCount, weeklyVisitorTotal },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    }
  );
}
