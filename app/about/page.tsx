import React from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import AboutStory from "./AboutStory";

export const metadata = {
  title: "nicchyo について",
  description:
    "nicchyo は高知・日曜市のデジタル体験を探求するプロジェクトです。観光客・地元の方・出店者をつなぐプラットフォームの背景をご紹介します。",
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

export default async function AboutPage() {
  let weeklyVisitors: number | null = null;

  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

  if (hasSupabaseEnv) {
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
      if (!error && Array.isArray(data)) {
        weeklyVisitors = data.reduce(
          (sum, row) => sum + (typeof row.visitor_count === "number" ? row.visitor_count : 0),
          0
        );
      }
    } catch (error) {
      console.warn("[AboutPage] 訪問者数の取得に失敗しました:", error);
    }
  }

  return (
    <main className="min-h-screen bg-amber-50">
      <AboutStory weeklyVisitors={weeklyVisitors} />
    </main>
  );
}
