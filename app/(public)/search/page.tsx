import { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import SearchClient from "./SearchClient";
import SearchLoading from "./loading";
import type { Shop } from "../map/data/shops";
import { fetchVendorShopsFromDb } from "../map/services/shopDb";
import type { Landmark } from "../map/types/landmark";
import { fetchLandmarksFromDb } from "../map/services/landmarksDb";

export const metadata: Metadata = {
  title: "店舗を探す",
  description: "高知・日曜市の300店舗から、お店の名前・商品・カテゴリーで検索できます。気になるお店を見つけてマップで確認しましょう。",
};

async function loadShops(): Promise<Shop[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    return await fetchVendorShopsFromDb(supabase);
  } catch {
    return [];
  }
}

async function loadLandmarks(): Promise<Landmark[]> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    return await fetchLandmarksFromDb(supabase);
  } catch {
    return [];
  }
}

// データ取得を分離することで Suspense のストリーミングが有効になる
async function SearchContent({ initialQuery }: { initialQuery?: string }) {
  const [shops, landmarks] = await Promise.all([loadShops(), loadLandmarks()]);
  return <SearchClient shops={shops} landmarks={landmarks} initialQuery={initialQuery} />;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const initialQuery = rawQuery?.trim() ?? '';

  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContent initialQuery={initialQuery} />
    </Suspense>
  );
}
