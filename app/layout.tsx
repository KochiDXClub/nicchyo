import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Mochiy_Pop_One } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { MenuProvider } from "@/lib/ui/MenuContext";
import FavoritesBagMigration from "@/app/components/FavoritesBagMigration";
import { PageVisibilityProvider } from "@/lib/pageVisibility/PageVisibilityContext";
import AppHeader from "./components/AppHeader";
import MapLoadingProvider from "./components/MapLoadingProvider";
import PageVisitTracker from "./components/PageVisitTracker";
import ViewportHeightUpdater from "./components/ViewportHeightUpdater";
import { Toaster } from "@/components/admin";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { SITE_URL } from "@/lib/constants";
import { DEFAULT_LOCALE, LOCALE_HEADER, toLocale } from "@/lib/i18n/config";

// 見出し用の丸文字。以前は globals.css の @import で Google Fonts から読んでいたが、
// それだと「ページの CSS → Google の CSS（約110KB）」を読み終えるまで画面が描かれず、
// 遅い回線では最初の表示が数秒遅れていた。next/font でビルド時に取り込み、自サイトから配信する。
// 使う画面が限られるので先読み（preload）はしない（地図などの読み込みと回線を取り合わないため）
const mochiyPopOne = Mochiy_Pop_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-mochiy",
});

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // "./" は各ページ自身のパスに展開される（クエリは含まない）。
  // www や ?utm_ 付きなど複数のURLで開けても、評価を https://nicchyo.jp/… に集約する
  alternates: { canonical: "./" },
  title: {
    default: "nicchyo | 高知の日曜市を、未来へつなぐ",
    template: "%s | nicchyo",
  },
  description:
    "高知の日曜市を舞台に、観光客・地元・市場がつながるデジタルプラットフォーム。毎週日曜開催の路上市場をインタラクティブ地図・AI案内で楽しもう。",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "nicchyo（ニッチョ）",
    title: "nicchyo | 高知の日曜市を、未来へつなぐ",
    description:
      "高知の日曜市を舞台に、観光客・地元・市場がつながるデジタルプラットフォーム。毎週日曜開催の路上市場をインタラクティブ地図・AI案内で楽しもう。",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "nicchyo – 高知の日曜市マップ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "nicchyo | 高知の日曜市を、未来へつなぐ",
    description:
      "高知の日曜市を舞台に、観光客・地元・市場がつながるデジタルプラットフォーム。",
    images: ["/og-default.png"],
  },
};

/**
 * 英語のページ（/en/…）は、本文の翻訳がそろい hreflang・sitemap を整えるまで検索エンジンに出さない
 * （ほぼ日本語のページが全ルート分、別URLとして索引に載るのを避けるため）。
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = toLocale((await headers()).get(LOCALE_HEADER));
  if (locale === DEFAULT_LOCALE) return baseMetadata;
  return { ...baseMetadata, robots: { index: false, follow: true } };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "nicchyo（ニッチョ）",
  url: SITE_URL,
  description:
    "高知の日曜市を舞台に、観光客・地元・市場がつながるデジタルプラットフォーム。",
  logo: `${SITE_URL}/icon.png`,
  areaServed: {
    "@type": "Place",
    name: "高知県高知市",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts が発行した CSP nonce を読む。
  // headers() を呼ぶことで全ページがリクエスト時描画（dynamic）になり、Next.js が
  // <script> に nonce を付与できる。静的生成された HTML には nonce が無く、
  // script-src 'nonce-…' 'strict-dynamic' の CSP で全スクリプトがブロックされて
  // ハイドレーションしない（近況ページが提灯ローディングで止まる等）ため必須。
  // https://nextjs.org/docs/app/guides/content-security-policy#nonces
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const locale = toLocale(requestHeaders.get(LOCALE_HEADER));

  return (
    <html lang={locale} className={mochiyPopOne.variable}>
      <head>
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
        />
      </head>
      <body className="bg-nicchyo-base text-nicchyo-ink">
        <ViewportHeightUpdater />
        <AuthProvider>
          <PageVisibilityProvider>
            <MenuProvider>
              <MapLoadingProvider>
                <AppHeader />
                <FavoritesBagMigration />
                <Suspense fallback={null}>
                  <PageVisitTracker />
                </Suspense>
                {children}
                <Toaster />
              </MapLoadingProvider>
            </MenuProvider>
          </PageVisibilityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
