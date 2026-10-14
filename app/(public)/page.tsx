import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import { siteText } from "@/lib/siteCopy";
import { SUNDAY_MARKET_JSON_LD } from "@/lib/seo/sundayMarketJsonLd";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { fetchPublicShops } from "./map/services/shopCache";
import LandingHero from "./_landing/LandingHero";
import LandingAbout from "./_landing/LandingAbout";
import LandingHighlights from "./_landing/LandingHighlights";
import LandingShop from "./_landing/LandingShop";
import LandingNichiyosan from "./_landing/LandingNichiyosan";
import LandingMessage from "./_landing/LandingMessage";
import { pickLandingShopPhotos } from "./_landing/pickLandingShops";

const title = "nicchyo（ニッチョ）| 高知高専生が開発した日曜市のデジタルマップ";
// 日曜市の数字（約1.3km・およそ300の店）はマップの案内と同じシートの文言から作る（太字の印は外す）
const description = `${siteText("mapIntro.lead").replaceAll("**", "")}高知高専の学生が開発した、地図で店を探せて AI のにちよさんに相談できる日曜市のデジタルマップです。`;
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
 * 「何のサイトか」「日曜市とは」を読めるよう、写真が主役の紹介ページにした。
 * 地図へは最初の画面と最後のメッセージから1回で行ける。
 *
 * 「出店しているお店から」の写真は、地図と同じ公開店舗（fetchPublicShops。キャッシュ済み）から選ぶ。
 * 取れなかったときは、その帯を出さないだけでページは表示する。「お店の紹介」は見本の店（SAMPLE_SHOP）
 */
export default async function HomePage() {
  const shops = await fetchPublicShops().catch(() => []);
  const photos = pickLandingShopPhotos(shops);

  return (
    // 下のナビ（サブページでは「マップにもどる」の帯）は出さない。ここは入口なので「もどる」先が無い
    <PageShell bottomNav={false}>
      {/* 日曜市の開催情報（/map と同じもの）。検索結果に開催日と場所を出してもらう */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(SUNDAY_MARKET_JSON_LD) }} />
      <main>
        <LandingHero />
        <LandingAbout />
        <LandingHighlights shopPhotos={photos} />
        <LandingShop />
        <LandingNichiyosan />
        <LandingMessage />
      </main>
    </PageShell>
  );
}
