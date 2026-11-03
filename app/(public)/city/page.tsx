import type { Metadata } from "next";
import { PageContainer, PageShell, PageTitle } from "@/components/ui";
import { CityMarketDays } from "./CityMarketDays";

export const metadata: Metadata = {
  title: "高知市のページ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）向けのトップ。開催ステータスの更新（利用状況の閲覧は後続で追加） */
export default function CityPage() {
  return (
    <PageShell bottomNav={false}>
      <PageTitle title="高知市のページ" />
      <PageContainer as="main">
        <CityMarketDays />
      </PageContainer>
    </PageShell>
  );
}
