import type { Metadata } from "next";
import { PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";

export const metadata: Metadata = {
  title: "高知市のページ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）向けのトップ。機能は順に追加する（開催ステータスの更新 → 利用状況の閲覧） */
export default function CityPage() {
  return (
    <PageShell bottomNav={false}>
      <PageTitle title="高知市のページ" />
      <PageContainer as="main">
        <Surface padding="md">
          <p className="text-sm text-nicchyo-ink/70">
            高知市ご担当者さま向けのページです。開催ステータスの更新や、利用状況の閲覧を
            順次ご利用いただけるようにします。
          </p>
        </Surface>
      </PageContainer>
    </PageShell>
  );
}
