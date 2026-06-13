import { Suspense } from "react";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { MenuProvider } from "@/lib/ui/MenuContext";
import { BagProvider } from "@/lib/storage/BagContext";
import AppHeader from "./components/AppHeader";
import MapLoadingProvider from "./components/MapLoadingProvider";
import PageVisitTracker from "./components/PageVisitTracker";
import CookieConsent from "./components/CookieConsent";
import ViewportHeightUpdater from "./components/ViewportHeightUpdater";
import { Toaster } from "@/components/admin";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicchyo.jp"),
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicchyo.jp";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "nicchyo（ニッチョ）",
  url: SITE_URL,
  description:
    "高知の日曜市を舞台に、観光客・地元・市場がつながるデジタルプラットフォーム。",
  logo: `${SITE_URL}/og-default.png`,
  areaServed: {
    "@type": "Place",
    name: "高知県高知市",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="ja">
      <head>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="bg-nicchyo-base text-nicchyo-ink">
        <CookieConsent />
        <ViewportHeightUpdater />
        <AuthProvider>
          <BagProvider>
            <MenuProvider>
              <MapLoadingProvider>
                <AppHeader />
                <Suspense fallback={null}>
                  <PageVisitTracker />
                </Suspense>
                {children}
                <Toaster />
              </MapLoadingProvider>
            </MenuProvider>
          </BagProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
