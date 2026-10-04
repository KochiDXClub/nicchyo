import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseShopLocation } from "@/lib/admin/shopLocation";
import { createMapLayoutSnapshot } from "@/app/api/admin/map-layout/_shared";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocationRow = { id: string; store_number: number; latitude: number; longitude: number };

/**
 * 現地で位置を決めるための、全店番の位置と、この店舗の現在の位置。
 * 地図に周りの区画を出して、どの店番がどこかを見ながら置けるようにする。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { adminClient } = auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [locations, assignments, vendors] = await Promise.all([
    adminClient.from("market_locations").select("id, store_number, latitude, longitude"),
    adminClient.from("location_assignments").select("location_id, vendor_id"),
    adminClient.from("vendors").select("id, shop_name"),
  ]);
  if (locations.error || assignments.error || vendors.error) {
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

  return NextResponse.json({ locations: rows, current: rows.find((r) => r.vendorId === id) ?? null });
}

/**
 * 店舗を店番に置き、その店番の座標を決める。
 * - 店番の区画がなければ作る。あれば座標を更新する
 * - その店番を別の店舗が使っているときは、force: true がない限り 409 で断る（上書きの確認用）
 * - この店舗が別の店番に置かれていたときは、そちらを外す（1店舗1店番）
 * 保存の前に、既存の地図編集と同じ形でスナップショットを残す（誤操作を戻せるように）。
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-location", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;

    const parsed = parseShopLocation(guard.body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { storeNumber, lat, lng, force } = parsed.value;

    const { data: vendor } = await adminClient.from("vendors").select("shop_name").eq("id", id).maybeSingle();
    if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    const { data: existing, error: existingError } = await adminClient
      .from("market_locations")
      .select("id")
      .eq("store_number", storeNumber)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: "位置を取得できませんでした" }, { status: 500 });

    // 店番を別の店舗が使っていないか
    if (existing) {
      const { data: occupant } = await adminClient
        .from("location_assignments")
        .select("vendor_id")
        .eq("location_id", existing.id)
        .neq("vendor_id", id)
        .limit(1)
        .maybeSingle();
      if (occupant && !force) {
        const { data: occupantVendor } = await adminClient
          .from("vendors")
          .select("shop_name")
          .eq("id", occupant.vendor_id)
          .maybeSingle();
        return NextResponse.json(
          {
            error: `店番 ${storeNumber} は「${occupantVendor?.shop_name ?? "別の店舗"}」が使っています`,
            code: "STORE_NUMBER_TAKEN",
            occupantName: occupantVendor?.shop_name ?? null,
          },
          { status: 409 },
        );
      }
    }

    // 戻せるように、書く前の状態を残す。残せなければ書かない
    const supabase = createServerClient(await cookies());
    await createMapLayoutSnapshot(supabase, adminClient as unknown as SupabaseClient, user.id, { updatedShopCount: 1 });

    // 区画の作成・更新と割り当ての入れ替えは、DB 関数で 1 トランザクションにする
    const { data: placed, error: placeError } = await adminClient.rpc("admin_place_shop", {
      p_vendor_id: id,
      p_store_number: storeNumber,
      p_lat: lat,
      p_lng: lng,
      p_force: force,
    });
    if (placeError) return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
    // 確認のあとに、別の運営が先に置いたとき
    if ((placed as { status?: string } | null)?.status === "taken") {
      return NextResponse.json(
        { error: `店番 ${storeNumber} は別の店舗が使っています`, code: "STORE_NUMBER_TAKEN", occupantName: null },
        { status: 409 },
      );
    }

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_location_edit",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: `店番 ${storeNumber} に配置（${lat.toFixed(6)}, ${lng.toFixed(6)}）${force ? " / 別の店舗の割り当てを上書き" : ""}`,
        ipAddress: ip,
      },
    );

    revalidatePublicShops();
    return NextResponse.json({ ok: true, storeNumber });
  } catch {
    return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
  }
}
