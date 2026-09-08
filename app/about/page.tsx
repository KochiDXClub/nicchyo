import React from "react";
import { fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";
import AboutStory from "./AboutStory";

export const metadata = {
  title: "nicchyo について",
  description:
    "nicchyo は高知・日曜市のデジタル体験を探求するプロジェクトです。観光客・地元の方・出店者をつなぐプラットフォームの背景をご紹介します。",
};

export default async function AboutPage() {
  const weeklyVisitors = await fetchWeeklyVisitors();

  return (
    <main className="min-h-screen bg-amber-50">
      <AboutStory weeklyVisitors={weeklyVisitors} />
    </main>
  );
}
