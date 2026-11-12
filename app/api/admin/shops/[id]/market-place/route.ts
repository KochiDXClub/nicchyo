import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { loadSharedMarketPlaces, readAllMarketRows } from "@/lib/admin/marketPlaces.server";

export const dynamic = "force-dynamic";

type PlaceRow = { id: string; store_number: number; place_name: string | null; latitude: number; longitude: number };
type VendorRow = { id: string; shop_name: string; market_place_id: string | null };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "店舗IDが正しくありません" }, { status: 400 });
    const db = auth.adminClient as unknown as NonNullable<ReturnType<typeof createAdminClient>>;
    const [places, vendors, shared] = await Promise.all([
      readAllMarketRows(db, "market_locations", "id, store_number, place_name, latitude, longitude", "id"),
      db.from("vendors").select("id, shop_name, market_place_id").eq("id", id).maybeSingle(),
      loadSharedMarketPlaces(db),
    ]);
    if (places.error || vendors.error) return NextResponse.json({ error: "出店場所を取得できませんでした" }, { status: 503 });
    const vendor = vendors.data as VendorRow | null;
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });
    return NextResponse.json({
      currentLocationId: vendor.market_place_id ?? [...shared.values()].find((place) => place.vendors.some((item) => item.id === id))?.id ?? null,
      places: ((places.data ?? []) as PlaceRow[]).sort((a, b) => a.store_number - b.store_number).map((place) => ({
        ...place,
        vendors: shared.get(place.id)?.vendors ?? [],
      })),
    });
  } catch { return NextResponse.json({ error: "出店場所を取得できませんでした" }, { status: 500 }); }
}

/** 旧画面から単一の場所で上書きしない。出店予定管理で場所ごとに登録する。 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-market-place", limit: 60, json: true });
  if ("error" in guard) return guard.error;
  return NextResponse.json({ error: "出店場所は出店予定管理で登録してください。" }, { status: 409 });
}
