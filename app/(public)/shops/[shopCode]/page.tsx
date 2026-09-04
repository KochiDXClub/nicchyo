import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatShopIdToCode, normalizeShopCodeToId } from "@/lib/shops/route";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { SITE_URL } from "@/lib/constants";
import ReportButton from "./ReportButton";

type ShopPageProps = {
  params: Promise<{
    shopCode: string;
  }>;
};

type ShopBasic = {
  shop_name: string | null;
  strength: string | null;
  main_products: string[] | null;
  shop_image_url: string | null;
};

async function fetchShopBasic(shopId: number): Promise<ShopBasic | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseKey);
    const { data: locationData } = await supabase
      .from("market_locations")
      .select("id")
      .eq("store_number", shopId)
      .maybeSingle();
    if (!locationData) return null;

    const { data: assignmentData } = await supabase
      .from("location_assignments")
      .select("vendor_id")
      .eq("location_id", locationData.id)
      .order("market_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!assignmentData) return null;

    const { data } = await supabase
      .from("vendors")
      .select("shop_name, strength, main_products, shop_image_url")
      .eq("id", assignmentData.vendor_id)
      .maybeSingle();
    return data as ShopBasic | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { shopCode } = await params;
  const shopId = normalizeShopCodeToId(shopCode);
  if (shopId === null) return {};

  const code = formatShopIdToCode(shopId);
  if (!code) return {};

  const shop = await fetchShopBasic(shopId);
  const shopName = shop?.shop_name?.trim() || `店舗 ${code}`;
  const products = shop?.main_products?.slice(0, 3).join("・") ?? "";
  const description = products
    ? `${shopName}（高知・日曜市 ${code}番）の出店情報。取扱商品: ${products}。`
    : `${shopName}（高知・日曜市 ${code}番）の出店情報。インタラクティブ地図で場所を確認できます。`;

  const images = shop?.shop_image_url
    ? [{ url: shop.shop_image_url, width: 800, height: 600, alt: shopName }]
    : [{ url: "/og-default.png", width: 1200, height: 630, alt: shopName }];

  return {
    title: `${shopName} – 日曜市 ${code}番`,
    description,
    openGraph: {
      title: `${shopName} – 日曜市 ${code}番 | nicchyo`,
      description,
      images,
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

  const shop = await fetchShopBasic(shopId);
  const shopName = shop?.shop_name?.trim() || `店舗 ${normalizedCode}`;

  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: shopName,
    description: shop?.strength ?? `高知・日曜市 ${normalizedCode}番の出店者`,
    image: shop?.shop_image_url ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: "追手筋",
      addressLocality: "高知市",
      addressRegion: "高知県",
      addressCountry: "JP",
    },
    url: `${SITE_URL}/shops/${normalizedCode}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }}
      />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col gap-4 px-4 py-10">
        {/* 店舗ヘッダーカード */}
        <section className="w-full rounded-2xl border border-amber-100 bg-surface-warmwhite p-6 shadow-card">
          <p className="eyebrow">日曜市 {normalizedCode}番</p>
          <h1 className="mt-1 font-display text-2xl text-slate-900">{shopName}</h1>

          {shop?.strength && (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{shop.strength}</p>
          )}

          {shop?.main_products && shop.main_products.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {shop.main_products.map((product) => (
                <span
                  key={product}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                >
                  {product}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 店舗画像 */}
        {shop?.shop_image_url && (
          <div className="overflow-hidden rounded-2xl border border-amber-100 shadow-card">
            <Image
              src={shop.shop_image_url}
              alt={shopName}
              width={960}
              height={224}
              className="h-56 w-full object-cover"
            />
          </div>
        )}

        {/* マップへ戻るリンク */}
        <a
          href={`/map?shop=${normalizedCode}`}
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-white px-5 py-3 text-sm font-bold text-amber-800 shadow-chip transition hover:bg-amber-50"
        >
          🗺 マップで場所を確認する
        </a>

        <div className="flex justify-end">
          <ReportButton shopCode={normalizedCode} shopName={shopName} />
        </div>
      </main>
    </>
  );
}
