import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatShopIdToCode, normalizeShopCodeToId } from "@/lib/shops/route";
import { safeJsonLd } from "@/lib/utils/jsonLd";
import { fetchVendorShopsFromDb } from "../../map/services/shopDb";
import type { Shop } from "../../map/data/shops";
import ReportButton from "./ReportButton";
import ShopPageBanner from "./ShopPageBanner";

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

function createPublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey);
}

/** OGP とタイトル用の軽い取得。本文は下の fetchShop で地図と同じ形を取る */
async function fetchShopBasic(shopId: number): Promise<ShopBasic | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;

  try {
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

/**
 * 地図と同じ Shop を取る。
 * 地図のバナーをそのまま出すので、地図と同じ取得経路（fetchVendorShopsFromDb）を通す。
 * 1店のために全店を引くが、地図ページも同じ処理を毎回しているので負荷は変わらない。
 */
async function fetchShop(shopId: number): Promise<Shop | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
  try {
    const shops = await fetchVendorShopsFromDb(supabase);
    return shops.find((shop) => shop.id === shopId) ?? null;
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
