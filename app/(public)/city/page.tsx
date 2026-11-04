import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin";

export const metadata: Metadata = {
  title: "高知市のページ",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）向けのトップ。機能は順に追加する（開催ステータスの更新 → 利用状況の閲覧） */
export default function CityPage() {
  return (
    <>
      <AdminPageHeader eyebrow="高知市" title="高知市のページ" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          高知市ご担当者さま向けのページです。開催ステータスの更新や、利用状況の閲覧を
          順次ご利用いただけるようにします。
        </div>
      </div>
    </>
  );
}
