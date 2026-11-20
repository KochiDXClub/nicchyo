import { Metadata } from "next";
import StoryGridClient from "./StoryGridClient";
import TodayMarketNotice from "@/app/components/market/TodayMarketNotice";
import { fetchPublicMarkets } from "@/lib/market/publicMarkets.server";
import { siteTextFor } from "@/lib/siteCopy";
import { getPublishedSiteCopy } from "@/lib/site-copy/server";

export async function generateMetadata(): Promise<Metadata> {
  const { texts } = await getPublishedSiteCopy();
  return {
    title: siteTextFor("story.meta.title", "ja", texts),
    description: siteTextFor("story.meta.description", "ja", texts),
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
