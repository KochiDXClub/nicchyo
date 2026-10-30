import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isPathVisibleToCurrentUser } from "@/lib/pageVisibility/server";
import PreparingNotice from "./components/PreparingNotice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "準備中",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // マップを見てよい人（本番では既定で管理者のみ。管理画面のページ公開設定で変えられる）は従来どおり地図へ。
  // そうでなければ「準備中」を出す
  if (await isPathVisibleToCurrentUser("/map")) redirect("/map");
  return <PreparingNotice />;
}
