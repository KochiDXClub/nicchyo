import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { readPublicScheduleRollout } from "@/lib/market-schedule/rollout.server";
import { fetchPublicShopProfiles } from "@/app/(public)/map/services/shopCache";

export const dynamic = "force-dynamic";

// 近況フィードの取得上限（際限なくレスポンスが膨らむのを防ぐ）
const STORIES_LIMIT = 100;

type StoryRecord = {
  id: string;
  body: string | null;
  image_url: string;
  expires_at: string;
  created_at: string;
  vendor: { id: string; shop_name: string | null; shop_image_url: string | null } | null;
};

type AssignmentRecord = {
  vendor_id: string | null;
  market_date: string | null;
  market_locations:
    | { store_number: number | null }
    | { store_number: number | null }[]
    | null;
};

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data, error } = await supabase
    .from("vendor_contents")
    .select(`
      id,
      body,
      image_url,
      expires_at,
      created_at,
      vendor:vendor_id (
        id,
        shop_name,
        shop_image_url
      )
    `)
    // RLS の「vendors can read own contents」ポリシー（状態・期限条件なし）が
    // OR 結合されるため、本人の hidden/deleted 投稿が混ざらないよう status を明示する
    .eq("status", "active")
    .not("image_url", "is", null)
    // 「今週だけ」ではなく「褪せていくタイムライン」として、期限切れも含めて
    // 過去約1か月分を表示する（鮮度は created_at で退色表現する）。
    .gte("created_at", new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(STORIES_LIMIT);

  if (error) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  const stories = (data ?? []) as unknown as StoryRecord[];

  // 公開切替後は店舗プロフィールの固定 ID を使用し、出店しない週も近況から店へ移動できる。
  // 旧表示中だけ location_assignments の最新の場所番号を使用する。
  const vendorIds = Array.from(
    new Set(stories.map((s) => s.vendor?.id).filter((v): v is string => !!v))
  );
  const storeNumberByVendor = new Map<string, number>();
  let rollout: boolean | null = null;
  try { rollout = await readPublicScheduleRollout(); } catch { /* 参照できないときは古い場所番号へ戻さない */ }
  if (rollout === true) {
    try {
      for (const shop of await fetchPublicShopProfiles()) if (shop.vendorId) storeNumberByVendor.set(shop.vendorId, shop.id);
    } catch { /* 投稿は返し、店舗へのリンクだけ非表示にする */ }
  } else if (rollout === false && vendorIds.length > 0) {
    const { data: assignments } = await supabase
      .from("location_assignments")
      .select("vendor_id, market_date, market_locations(store_number)")
      .in("vendor_id", vendorIds)
      .order("market_date", { ascending: false });
    for (const row of (assignments ?? []) as unknown as AssignmentRecord[]) {
      if (!row.vendor_id || storeNumberByVendor.has(row.vendor_id)) continue;
      const loc = Array.isArray(row.market_locations)
        ? row.market_locations[0]
        : row.market_locations;
      if (loc && typeof loc.store_number === "number") {
        storeNumberByVendor.set(row.vendor_id, loc.store_number);
      }
    }
  }

  const withStoreNumber = stories.map((s) => ({
    ...s,
    vendor: s.vendor
      ? { ...s.vendor, store_number: storeNumberByVendor.get(s.vendor.id) ?? null }
      : null,
  }));

  return NextResponse.json(withStoreNumber);
}
