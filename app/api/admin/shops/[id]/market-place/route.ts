import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { loadSharedMarketPlaces, readAllMarketRows } from "@/lib/admin/marketPlaces.server";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";

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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-market-place", limit: 60, json: true });
    if ("error" in guard) return guard.error;
    const { adminClient, user, role, id, ip } = guard.ctx;
    const body = guard.body as { locationId?: unknown; name?: unknown; confirmed?: unknown; updatedAt?: unknown; expectedName?: unknown } | null;
    if (!body || !(body.locationId === null || (typeof body.locationId === "string" && UUID_RE.test(body.locationId))) || (body.locationId !== null && (typeof body.name !== "string" || !body.name.trim() || Array.from(body.name).length > 100)) || typeof body.confirmed !== "boolean" || !(body.expectedName === null || (typeof body.expectedName === "string" && Array.from(body.expectedName).length <= 100)) || !(body.updatedAt === null || (typeof body.updatedAt === "string" && !Number.isNaN(Date.parse(body.updatedAt))))) {
      return NextResponse.json({ error: "出店場所と区画を確認してください" }, { status: 400 });
    }
    const db = adminClient as unknown as NonNullable<ReturnType<typeof createAdminClient>>;
    const { data, error } = await db.rpc("set_vendor_market_place", { p_vendor: id, p_location: body.locationId, p_name: typeof body.name === "string" ? body.name.trim() : null, p_confirm: body.confirmed, p_expected_updated_at: body.updatedAt, p_expected_name: body.expectedName });
    if (error) return NextResponse.json({ error: "出店場所を保存できませんでした" }, { status: 500 });
    const result = data as { status: string; count?: number; updatedAt?: string | null; currentName?: string; promoted?: string[] };
    if (result.status === "confirmation_required") return NextResponse.json({ error: "この出店場所には別の店舗も登録されています。地図配置だけがある店舗も同じ出店場所に紐づけます。登録しますか？", needsConfirmation: true, count: result.count }, { status: 409 });
    if (result.status === "rename_confirmation_required") return NextResponse.json({ error: `「${result.currentName}」の場所名を「${String(body.name).trim()}」に変更します。この場所を登録している全店舗に反映されます。`, needsConfirmation: true, count: result.count }, { status: 409 });
    const errors: Record<string, string> = {
      stale_vendor: "店舗の情報が別の画面で更新されました。再読み込みしてから設定してください。",
      place_name_changed: "出店場所の名前が別の画面で更新されました。再読み込みしてから設定してください。",
      map_assignment_exists: "地図上の配置から出店場所が決まっています。解除する場合は先にマップ編集で配置を外してください。",
      vendor_missing: "店舗が見つかりません", location_missing: "区画が見つかりません", invalid_name: "出店場所名を入力してください",
      location_has_name: "この区画には別の出店場所名が登録されています。登録済みの名前を選んでください。",
      name_in_use: "同じ名前の出店場所が別の区画にあります。登録済みの区画を選んでください。",
      existing_assignment_mismatch: "この店舗は地図上で別の区画に割り当てられています。先にマップ編集で配置を確認してください。",
    };
    if (result.status !== "ok") return NextResponse.json({ error: errors[result.status] ?? "出店場所を保存できませんでした" }, { status: 409 });
    await logAdminAudit(adminClient, { id: user.id, email: user.email, role }, { action: "shop_location_edit", targetType: "vendor", targetId: id, details: body.locationId ? `出店場所を登録: ${String(body.expectedName ?? "未設定")} → ${String(body.name).trim()} / 既存配置から紐付け: ${(result.promoted ?? []).join(", ") || "なし"}` : "出店場所の登録を解除", ipAddress: ip });
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt ?? null });
  } catch { return NextResponse.json({ error: "出店場所を保存できませんでした" }, { status: 500 }); }
}
