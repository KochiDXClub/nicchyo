import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatShopIdToCode } from "@/lib/shops/route";
import {
  EMPTY_PAGE_VISIBILITY_SETTINGS,
  isLinkVisible,
  parsePageVisibilitySettings,
  type PageVisibilitySettings,
} from "@/lib/pageVisibility";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nicchyo.jp";

// ページ公開設定・出店状況の変更を1時間以内に反映する
export const revalidate = 3600;

/** 未ログイン向けに public でないページは sitemap.xml に載せない */
async function fetchPageVisibility(): Promise<PageVisibilitySettings> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) return EMPTY_PAGE_VISIBILITY_SETTINGS;

  try {
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "page_visibility")
      .maybeSingle();
    return parsePageVisibilitySettings(data?.value);
  } catch {
    return EMPTY_PAGE_VISIBILITY_SETTINGS;
  }
}

// 静的ページ一覧
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/map`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
  { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/consult`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
];

async function fetchActiveShopNumbers(): Promise<number[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseKey);
    const { data } = await supabase
      .from("market_locations")
      .select("store_number")
      .not("store_number", "is", null)
      .gte("store_number", 1)
      .lte("store_number", 300);

    if (!data) return [];
    return data
      .map((row: { store_number: number | null }) => row.store_number)
      .filter((n): n is number => n !== null && Number.isFinite(n));
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
