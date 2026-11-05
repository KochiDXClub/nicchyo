import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin";
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
    <>
      <AdminPageHeader eyebrow="高知市" title="高知市のページ" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="space-y-8">
          <CityMarketDays />
          <CitySummary />
        </div>
      </div>
    </>
  );
}
