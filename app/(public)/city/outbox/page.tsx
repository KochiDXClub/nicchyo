import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin";
import { CityOutbox } from "./CityOutbox";

export const metadata: Metadata = {
  title: "お知らせを出す",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** 高知市（市役所）から、サイトの来訪者と出店者へお知らせを出す */
export default function CityOutboxPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="高知市"
        title="お知らせを出す"
        description="サイト内のお知らせ(来訪者向け)と、出店者へのお知らせを出します。出せるのは自分が出したものの確認と取り下げまでです。"
      />
      <CityOutbox />
    </>
  );
}
