"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  fetchAiConsultAnalytics,
  fetchMyProductNames,
  fetchProductSearchTrends,
  fetchShopViews,
  fetchVendorHeartSummary,
} from "../_services/analyticsService";
import type { AiConsultAnalytics, HeartSummary, SearchKeywordTrend, ShopViewSummary } from "../_types";
import HeroStats from "./components/HeroStats";
import QuestionsSection from "./components/QuestionsSection";
import SearchDemandSection from "./components/SearchDemandSection";
import ViewsSection from "./components/ViewsSection";

/** 取れなかったもの（null）は、0 と見間違えないよう、その場所だけ「読めんかった」にする */
type Loaded = {
  views: ShopViewSummary | null;
  consult: AiConsultAnalytics | null;
  hearts: HeartSummary | null;
  trends: SearchKeywordTrend[] | null;
};

const settled = <T,>(result: PromiseSettledResult<T>): T | null => (result.status === "fulfilled" ? result.value : null);

function LoadFailed({ what }: { what: string }) {
  return (
    <Surface>
      <p className="text-sm text-nicchyo-ink/70">{what}を読めんかった。もういっぺん開いてみてや。</p>
    </Surface>
  );
}

/**
 * お店の分析。1枚の縦長のページに、出店者が次の行動を決めるのに要る数字だけを並べる。
 * 上から：見られた回数 → いつ・どこから → お客さんの質問 → 探されているもの
 */
export default function VendorAnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [views, consult, hearts, trends] = await Promise.allSettled([
        fetchShopViews(user.id),
        fetchAiConsultAnalytics(user.id),
        fetchVendorHeartSummary(),
        fetchMyProductNames(user.id).then(fetchProductSearchTrends),
      ]);
      if (!cancelled) {
        setData({ views: settled(views), consult: settled(consult), hearts: settled(hearts), trends: settled(trends) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="お店の分析" />
      <PageContainer width="reading" className="flex flex-col gap-4">
        {!data ? (
          <CenteredLoading />
        ) : (
          <>
            <HeroStats
              views={data.views}
              recommendationCount={data.consult?.recommendationCount ?? null}
              hearts={data.hearts}
            />
            {data.views && <ViewsSection views={data.views} />}
            {data.consult ? <QuestionsSection consult={data.consult} /> : <LoadFailed what="お客さんの相談" />}
            {data.trends ? <SearchDemandSection trends={data.trends} /> : <LoadFailed what="探されているもの" />}
          </>
        )}
      </PageContainer>
    </PageShell>
  );
}
