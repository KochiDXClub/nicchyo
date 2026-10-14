import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import LandingHero from "./_landing/LandingHero";
import LandingNichiyosan from "./_landing/LandingNichiyosan";
import LandingFeatures from "./_landing/LandingFeatures";
import LandingMarketInfo from "./_landing/LandingMarketInfo";
import LandingClosing from "./_landing/LandingClosing";

const description =
  "高知の日曜市（毎週日曜・追手筋）をはじめてでも楽しめるデジタルマップ。およそ300の店を地図で探せて、AIのにちよさんに食べ歩きや回り方を相談できます。";

export const metadata: Metadata = {
  // トップはサイト名を先頭に出す（各ページの「%s | nicchyo」ではなく、検索結果でいちばん目に入る形）
  title: { absolute: "nicchyo（ニッチョ）| 高知・日曜市のマップとAI案内" },
  description,
  openGraph: {
    title: "nicchyo（ニッチョ）| 高知・日曜市のマップとAI案内",
    description,
  },
};

/**
 * トップページ。以前は /map へリダイレクトしていたが、検索や口コミで来た人が
 * 「何のサイトか」「日曜市とは」を読めるよう、チラシのような紹介ページにした。
 * 地図へはここから1回で行ける（最初の画面と最後に入口を置いている）
 */
export default function HomePage() {
  return (
    // 下のナビ（サブページでは「マップにもどる」の帯）は出さない。ここは入口なので「もどる」先が無く、
    // 地図への入口は最初の画面と最後に置いている
    <PageShell bottomNav={false}>
      <main>
        <LandingHero />
        <LandingNichiyosan />
        <LandingFeatures />
        <LandingMarketInfo />
        <LandingClosing />
      </main>
    </PageShell>
  );
}
