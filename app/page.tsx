import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isPathVisibleToCurrentUser } from "@/lib/pageVisibility/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "準備中",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // マップを見てよい人（本番では既定で管理者のみ。管理画面のページ公開設定で変えられる）は従来どおり地図へ。
  // そうでなければ「準備中」を出す
  if (await isPathVisibleToCurrentUser("/map")) redirect("/map");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-nicchyo-base px-4 text-center">
      <span className="text-6xl" aria-hidden="true">🌱</span>
      <h1 className="mt-6 font-display text-3xl font-bold text-nicchyo-ink">準備中です</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-nicchyo-ink/70">
        日曜市マップは、公開に向けて準備しているところです。
        <br />
        それまでのあいだ、見本のデータで動くデモマップをお試しいただけます。
      </p>
      <Link
        href="/demo/map"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-nicchyo-primary px-6 py-3 text-sm font-bold text-nicchyo-ink shadow-sm transition hover:opacity-90"
      >
        デモマップを見る
      </Link>
      <Link href="/login" className="mt-6 text-xs text-nicchyo-ink/55 underline underline-offset-2">
        管理者の方はログイン
      </Link>
      <p className="mt-8 text-xs text-nicchyo-ink/40">nicchyo – 日曜市デジタルマップ</p>
    </main>
  );
}
