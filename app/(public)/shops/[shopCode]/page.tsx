import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatShopIdToCode, normalizeShopCodeToId } from "@/lib/shops/route";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { resolveShopImage } from "@/lib/shopImages";
import { fetchVendorShopsFromDb } from "../../map/services/shopDb";
import type { Shop } from "../../map/data/shops";
import ReportButton from "./ReportButton";
import ShopPageBanner from "./ShopPageBanner";

type ShopPageProps = {
  params: Promise<{
    shopCode: string;
  }>;
};

function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * 地図と同じ Shop を取る。
 * 地図のバナーをそのまま出すので、地図と同じ取得経路（fetchVendorShopsFromDb）を通す。
 * 1店のために全店を引くが、地図ページも同じ処理を毎回しているので負荷は変わらない。
 * generateMetadata と本文の両方から呼ぶので cache() で1リクエスト1回にする。
 */
const fetchShop = cache(async (shopId: number): Promise<Shop | null> => {
  const supabase = createPublicClient();
  if (!supabase) return null;
  try {
    const shops = await fetchVendorShopsFromDb(supabase);
    return shops.find((shop) => shop.id === shopId) ?? null;
  } catch {
    return null;
  }
});

/**
 * 今アクセスされているホストの origin（https://nicchyo-git-xxx.vercel.app など）。
 * OGP の画像 URL は共有先（LINE・Discord）が取りに来るので、実際に配信している
 * ホストで組む。metadataBase（NEXT_PUBLIC_SITE_URL / nicchyo.jp）は本番ドメインが
 * まだ無いプレビュー環境では届かない URL になり、カードの画像が壊れる。
 */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { shopCode } = await params;
  const shopId = normalizeShopCodeToId(shopCode);
  if (shopId === null) return {};

  const code = formatShopIdToCode(shopId);
  if (!code) return {};

  const shop = await fetchShop(shopId);
  const shopName = shop?.name?.trim() || `店舗 ${code}`;
  const products = shop?.products?.slice(0, 3).join("・") ?? "";
  const description = products
    ? `${shopName}（高知・日曜市 ${code}番）の出店情報。取扱商品: ${products}。`
    : `${shopName}（高知・日曜市 ${code}番）の出店情報。インタラクティブ地図で場所を確認できます。`;

  // 共有カードの写真はバナーと同じ（登録写真 → カテゴリの既定写真）。
  // 相対パス（既定写真）は今のホストで絶対 URL にする
  const origin = await requestOrigin();
  const imagePath = shop ? resolveShopImage(shop) : "/og-default.png";
  const imageUrl = imagePath.startsWith("/") && origin ? `${origin}${imagePath}` : imagePath;
  const images = shop
    ? [{ url: imageUrl, width: 800, height: 600, alt: shopName }]
    : [{ url: imageUrl, width: 1200, height: 630, alt: shopName }];
  const pageTitle = `${shopName} – 日曜市 ${code}番`;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: `${pageTitle} | nicchyo`,
      description,
      images,
      ...(origin ? { url: `${origin}/shops/${code}` } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ShopPage({ params }: ShopPageProps) {
  const { shopCode } = await params;
  const shopId = normalizeShopCodeToId(shopCode);

  if (shopId === null) {
    notFound();
  }

  const normalizedCode = formatShopIdToCode(shopId);

  if (normalizedCode === null) {
    notFound();
  }

  const shop = await fetchShop(shopId);
  const shopName = shop?.name?.trim() || `店舗 ${normalizedCode}`;

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shopName,
    description: shop?.shopStrength ?? `高知・日曜市 ${normalizedCode}番の出店者`,
    image: shop?.images?.main ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: "追手筋",
      addressLocality: "高知市",
      addressRegion: "高知県",
      addressCountry: "JP",
    },
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicchyo.jp"}/shops/${normalizedCode}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }}
      />
      <main className="mx-auto w-full max-w-2xl bg-nicchyo-base">
        {shop ? (
          // 地図で屋台をタップしたときと同じバナーを、そのまま1ページとして出す
          <ShopPageBanner shop={shop} shopCode={normalizedCode} />
        ) : (
          <section className="mx-4 my-10 rounded-2xl border border-amber-100 bg-white p-6 shadow-card">
            <p className="text-xs font-semibold tracking-[0.12em] text-amber-700">日曜市 {normalizedCode}番</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{shopName}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              このお店の情報はまだ登録されていません。地図で場所だけ確認できます。
            </p>
            <a
              href={`/map?shop=${normalizedCode}`}
              className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-bold text-amber-800 shadow-chip transition hover:bg-amber-50"
            >
              マップで場所を確認する
            </a>
          </section>
        )}

        <div className="flex justify-end px-4 pb-8 pt-2">
          <ReportButton shopCode={normalizedCode} shopName={shopName} />
        </div>
      </main>
    </>
  );
}
