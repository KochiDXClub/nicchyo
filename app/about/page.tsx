import React from "react";
import { fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";
import { siteText } from "@/lib/siteCopy";
import AboutStory from "./AboutStory";

export const metadata = {
  title: siteText("about.meta.title"),
  description: siteText("about.meta.description"),
};

export default async function AboutPage() {
  const weeklyVisitors = await fetchWeeklyVisitors();

  return (
    <main className="min-h-screen bg-amber-50">
      <AboutStory weeklyVisitors={weeklyVisitors} />
    </main>
  );
}
