import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseShopLocation } from "@/lib/admin/shopLocation";
import { isMissingTableError } from "@/lib/admin/fieldShopLocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocationRow = { id: string; store_number: number; latitude: number; longitude: number };

/**
 * 現地で位置を決めるための、全店番の位置（地図のデータ）と、この店舗の現在の位置。
 * 地図に周りの区画を出して、どの店番がどこかを見ながら置けるようにする。
 * 現在の位置は、この店舗の現場登録の記録があればそれ、無ければ地図上の区画の位置（見るだけ）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { adminClient } = auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [locations, assignments, vendors, field] = await Promise.all([
    adminClient.from("market_locations").select("id, store_number, latitude, longitude"),
    adminClient.from("location_assignments").select("location_id, vendor_id"),
    adminClient.from("vendors").select("id, shop_name"),
    adminClient.from("field_shop_locations").select("store_number, latitude, longitude").eq("vendor_id", id).maybeSingle(),
  ]);
  if (locations.error || assignments.error || vendors.error) {
    return NextResponse.json({ error: "位置を取得できませんでした" }, { status: 500 });
  }
  if (field.error && !isMissingTableError(field.error)) {
    return NextResponse.json({ error: "位置を取得できませんでした" }, { status: 500 });
  }

  const nameById = new Map((vendors.data ?? []).map((v) => [v.id, v.shop_name ?? ""]));
  const vendorByLocation = new Map((assignments.data ?? []).map((a) => [a.location_id, a.vendor_id]));

  const rows = ((locations.data ?? []) as LocationRow[]).map((row) => {
    const vendorId = vendorByLocation.get(row.id) ?? null;
    return {
      storeNumber: row.store_number,
      lat: row.latitude,
      lng: row.longitude,
      vendorId,
      vendorName: vendorId ? nameById.get(vendorId) ?? "" : null,
    };
  });

  const record = field.data;
  const current =
    record && record.store_number != null && record.latitude != null && record.longitude != null
      ? { storeNumber: record.store_number, lat: record.latitude, lng: record.longitude, vendorId: id, vendorName: nameById.get(id) ?? "" }
      : rows.find((r) => r.vendorId === id) ?? null;

  return NextResponse.json({ locations: rows, current });
}

/**
 * 現場で聞き取った店番と座標を、この店舗の記録として保存する。
 * 地図のデータ（market_locations・location_assignments）は書き換えない。公開マップにも反映されない。
 * 地図への反映は、運営が記録を確かめて地図編集で行う。1 店舗につき最新の 1 件だけ残す。
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-location", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const parsed = parseShopLocation(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { storeNumber, lat, lng } = parsed.value;

    const { data: vendor } = await adminClient.from("vendors").select("shop_name").eq("id", id).maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    const { error } = await adminClient
      .from("field_shop_locations")
      .upsert(
        { vendor_id: id, store_number: storeNumber, latitude: lat, longitude: lng, updated_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: "vendor_id" },
      );
    if (error) return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_location_edit",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: `現場登録: 店番 ${storeNumber} の位置を記録（${lat.toFixed(6)}, ${lng.toFixed(6)}）。地図には反映していない`,
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true, storeNumber });
  } catch {
    return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
  }
}
