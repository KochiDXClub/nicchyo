import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import { siteText } from "@/lib/siteCopy";
import LandingHero from "./_landing/LandingHero";
import LandingNichiyosan from "./_landing/LandingNichiyosan";
import LandingFeatures from "./_landing/LandingFeatures";
import LandingMarketInfo from "./_landing/LandingMarketInfo";
import LandingClosing from "./_landing/LandingClosing";

const title = "nicchyo（ニッチョ）| 高知・日曜市のマップとAI案内";
// 日曜市の数字（約1.3km・およそ300の店）はマップの案内と同じシートの文言から作る（太字の印は外す）
const description = `${siteText("mapIntro.lead").replaceAll("**", "")}はじめてでも地図で店を探せて、AIのにちよさんに食べ歩きや回り方を相談できるデジタルマップです。`;
const ogImage = { url: "/og-default.png", width: 1200, height: 630, alt: "nicchyo – 高知の日曜市マップ" };

export const metadata: Metadata = {
  // トップはサイト名を先頭に出す（各ページの「%s | nicchyo」ではなく、検索結果でいちばん目に入る形）
  title: { absolute: title },
  description,
  // openGraph・twitter は丸ごと上書きになる（layout と深くは混ざらない）ので、画像なども書き直す
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "nicchyo（ニッチョ）",
    title,
    description,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage.url],
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
