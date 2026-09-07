/**
 * 今週の訪問者数を数える（サーバー側）
 *
 * /about と /support が同じ数字を出すので、取り方をここに置く。
 * 取れなかったときは null を返し、呼び出し側で「集計中」として扱う。
 * 数字が出ないことよりページが落ちることの方が困るので、失敗は握りつぶす。
 */

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/** 日曜市は日曜開催なので、週は月曜はじまりで数える */
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

function hasSupabaseEnv() {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );
}

/** 今週（月曜〜今日）の訪問者数。取れなければ null */
export async function fetchWeeklyVisitors(): Promise<number | null> {
  if (!hasSupabaseEnv()) return null;

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const todayIso = getTokyoTodayIso();
    const weekStartIso = getWeekStartIso(todayIso);
    const { data, error } = await supabase
      .from("web_visitor_stats")
      .select("visitor_count")
      .gte("visit_date", weekStartIso)
      .lte("visit_date", todayIso);

    if (error || !Array.isArray(data)) return null;

    return data.reduce(
      (sum, row) => sum + (typeof row.visitor_count === "number" ? row.visitor_count : 0),
      0
    );
  } catch (error) {
    console.warn("[weeklyVisitors] 訪問者数の取得に失敗しました:", error);
    return null;
  }
}
