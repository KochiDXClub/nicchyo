import React from "react";
import { fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";
import { siteTextFor } from "@/lib/siteCopy";
import { getPublishedSiteCopy } from "@/lib/site-copy/server";
import AboutStory from "./AboutStory";

export async function generateMetadata() {
  const { texts } = await getPublishedSiteCopy();
  return { title: siteTextFor("about.meta.title", "ja", texts), description: siteTextFor("about.meta.description", "ja", texts) };
}

export default async function AboutPage() {
  const weeklyVisitors = await fetchWeeklyVisitors();

  return (
    <main className="min-h-screen bg-amber-50">
      <AboutStory weeklyVisitors={weeklyVisitors} />
    </main>
  );
}
