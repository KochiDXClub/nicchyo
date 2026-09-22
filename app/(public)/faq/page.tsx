import NavigationBar from "../../components/NavigationBar";
import { PageContainer, PageShell, Surface } from "@/components/ui";
import FaqClient from "./FaqClient";

export const metadata = {
  title: "よくある質問",
  description: "nicchyo（日曜市マップ）の使い方や、高知・日曜市に関するよくある質問をまとめました。",
};

export default function FAQPage() {
  return (
    <PageShell as="main">
      {/* 見出しの帯。地から中身に移る手前に主色を薄く敷いて、視線の入口を作る */}
      <div className="bg-gradient-to-b from-amber-100/50 to-transparent pb-6 pt-safe-top">
        <PageContainer width="narrow" className="pt-6">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">よくある質問</h1>

          <Surface>
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              日曜市マップの使い方や、困ったときの解決方法をまとめました。キーワード検索もご利用いただけます。
            </p>
          </Surface>
        </PageContainer>
      </div>

      <PageContainer width="narrow">
        <FaqClient />
      </PageContainer>

      <NavigationBar />
    </PageShell>
  );
}
