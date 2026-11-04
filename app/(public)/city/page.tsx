import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin";
import { CityMarketDays } from "./CityMarketDays";

export const metadata: Metadata = {
  title: "高知市のページ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）向けのトップ。開催ステータスの更新（利用状況の閲覧は後続で追加） */
export default function CityPage() {
  return (
    <>
      <AdminPageHeader eyebrow="高知市" title="高知市のページ" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <CityMarketDays />
      </div>
    </>
  );
}
