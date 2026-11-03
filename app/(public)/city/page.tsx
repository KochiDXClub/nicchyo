import type { Metadata } from "next";
import { PageContainer, PageShell, PageTitle } from "@/components/ui";
import { CityMarketDays } from "./CityMarketDays";
import { CitySummary } from "./CitySummary";

export const metadata: Metadata = {
  title: "高知市のページ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）向けのトップ。開催ステータスの更新と、利用状況・日曜市の記録の閲覧 */
export default function CityPage() {
  return (
    <PageShell bottomNav={false}>
      <PageTitle title="高知市のページ" />
      <PageContainer as="main">
        <div className="space-y-8">
          <CityMarketDays />
          <CitySummary />
        </div>
      </PageContainer>
    </PageShell>
  );
}
