import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatShopIdToCode } from "@/lib/shops/route";
import { SITE_URL } from "@/lib/constants";
import { ACTIVITIES } from "@/app/data/activities";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";
import {
  EMPTY_PAGE_VISIBILITY_SETTINGS,
  isLinkVisible,
  applyEnvironmentDefaults,
  parsePageVisibilitySettings,
  type PageVisibilitySettings,
} from "@/lib/pageVisibility";

// ページ公開設定・出店状況の変更を1時間以内に反映する
export const revalidate = 3600;

/** 未ログイン向けに public でないページは sitemap.xml に載せない */
async function fetchPageVisibility(): Promise<PageVisibilitySettings> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) return applyEnvironmentDefaults(EMPTY_PAGE_VISIBILITY_SETTINGS);

  try {
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "page_visibility")
      .maybeSingle();
    return applyEnvironmentDefaults(parsePageVisibilitySettings(data?.value));
  } catch {
    return applyEnvironmentDefaults(EMPTY_PAGE_VISIBILITY_SETTINGS);
  }
}

// 静的ページ一覧
// lastModified は載せない: 毎回「今」を入れると更新日として信用されなくなるため。
// /news は /calendar へ、/search は /map へ恒久リダイレクトしているので載せない（リダイレクト先を載せる）
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1.0 },
  { url: `${SITE_URL}/map`, changeFrequency: "daily", priority: 1.0 },
  { url: `${SITE_URL}/calendar`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/consult`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/story`, changeFrequency: "weekly", priority: 0.6 },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/activities`, changeFrequency: "monthly", priority: 0.4 },
  ...ACTIVITIES.map((activity) => ({
    url: `${SITE_URL}/activities/${activity.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  })),
  { url: `${SITE_URL}/support`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
];

/** 店舗ページ（/shops/NNN）に載せる店番。/map・店舗詳細と同じ公開店舗の基準（fetchPublicShops）に揃える */
async function fetchActiveShopNumbers(): Promise<number[]> {
  try {
    const shops = await fetchPublicShops();
    return shops.map((shop) => shop.id).filter((id) => formatShopIdToCode(id) !== null);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [storeNumbers, visibility] = await Promise.all([fetchActiveShopNumbers(), fetchPageVisibility()]);
  const isPublic = (url: string) => isLinkVisible(url.slice(SITE_URL.length), "anon", visibility);

  const staticPages = STATIC_PAGES.filter((page) => isPublic(page.url));
  if (!isLinkVisible("/shops", "anon", visibility)) return staticPages;

  const shopPages: MetadataRoute.Sitemap = storeNumbers.flatMap((num) => {
    const code = formatShopIdToCode(num);
    if (!code) return [];
    return [
      {
        url: `${SITE_URL}/shops/${code}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      },
    ];
  });

  return [...staticPages, ...shopPages];
}
