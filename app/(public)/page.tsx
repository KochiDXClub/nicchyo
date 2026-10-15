import type { Metadata } from "next";
import { PageShell } from "@/components/ui";
import { siteText } from "@/lib/siteCopy";
import { SUNDAY_MARKET_JSON_LD } from "@/lib/seo/sundayMarketJsonLd";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { fetchMarketCalendar, type MarketDay } from "@/lib/market/calendar";
import { fetchPublicShops } from "./map/services/shopCache";
import { GENRES } from "./_landing/content";
import LandingHero from "./_landing/LandingHero";
import LandingGenres from "./_landing/LandingGenres";
import LandingHowTo from "./_landing/LandingHowTo";
import LandingInfo from "./_landing/LandingInfo";
import LandingHighlights from "./_landing/LandingHighlights";
import LandingAbout from "./_landing/LandingAbout";
import LandingForShops from "./_landing/LandingForShops";
import { pickGenrePhotos, pickLandingHeroShops, pickLandingShopPhotos } from "./_landing/pickLandingShops";

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

/** 今週の日曜市の開催状況。取れなかったときは null（バーは「開催」として出る。カレンダーと同じ扱い） */
async function fetchThisWeekMarketDay(): Promise<MarketDay | null> {
  try {
    const supabase = createClient(await cookies());
    return (await fetchMarketCalendar(supabase)).day;
  } catch {
    return null;
  }
}

/**
 * トップページ。以前は /map へリダイレクトしていたが、検索や口コミで来た人が
 * 「何のサイトか」「日曜市とは」を分かり、そのまま使い始められる案内のページにした。
 *
 * 並びは「すぐ使う → 知る → 信頼する」の順（市場の公式サイトのような案内型）:
 * 開催状況・さがす・地図（最初の画面）→ ジャンル → できること → 開催のご案内 → いいところ → nicchyo について → 出店者の方へ。
 * 画面に文字を増やさない。説明は一言にして、実際の画面の形と写真で見せる。
 *
 * 「出店しているお店から」の写真は、地図と同じ公開店舗（fetchPublicShops。キャッシュ済み）から選ぶ。
 * 取れなかったときは、その帯を出さないだけでページは表示する
 */
export default async function HomePage() {
  const [shops, day] = await Promise.all([fetchPublicShops().catch(() => []), fetchThisWeekMarketDay()]);
  const photos = pickLandingShopPhotos(shops);
  // 最初の写真の上に置く屋台マーカー。地図と同じ公開店舗から、色がばらけるよう4件
  const genrePhotos = pickGenrePhotos(shops, GENRES.map((genre) => genre.category));
  const heroShops = pickLandingHeroShops(shops, 4);

  return (
    // 下のナビ（サブページでは「マップにもどる」の帯）は出さない。ここは入口なので「もどる」先が無い
    <PageShell bottomNav={false}>
      {/* 日曜市の開催情報（/map と同じもの）。検索結果に開催日と場所を出してもらう */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(SUNDAY_MARKET_JSON_LD) }} />
      <main>
        <LandingHero day={day} shops={heroShops} />
        <LandingGenres photos={genrePhotos} />
        <LandingHowTo />
        <LandingInfo />
        <LandingHighlights shopPhotos={photos} />
        <LandingAbout />
        <LandingForShops />
      </main>
    </PageShell>
  );
}
