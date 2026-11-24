import { Metadata } from "next";
import StoryGridClient from "./StoryGridClient";
import TodayMarketNotice from "@/app/components/market/TodayMarketNotice";
import { fetchPublicMarkets } from "@/lib/market/publicMarkets.server";
import { getSiteText } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteText();
  return {
    title: s("story.meta.title"),
    description: s("story.meta.description"),
  };
}

export default async function StoryPage() {
  const markets = await fetchPublicMarkets();
  return (
    <>
      <TodayMarketNotice markets={markets} />
      <StoryGridClient />
    </>
  );
}
