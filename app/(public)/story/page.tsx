import { Metadata } from "next";
import StoryGridClient from "./StoryGridClient";
import TodayMarketNotice from "@/app/components/market/TodayMarketNotice";
import { fetchPublicMarkets } from "@/lib/market/publicMarkets.server";

export const metadata: Metadata = {
  title: "近況",
  description: "出店者の今週の写真投稿をチェックしよう。",
};

export default async function StoryPage() {
  const markets = await fetchPublicMarkets();
  return (
    <>
      <TodayMarketNotice markets={markets} />
      <StoryGridClient />
    </>
  );
}
