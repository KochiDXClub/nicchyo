import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseShopLocation } from "@/lib/admin/shopLocation";
import { createMapLayoutSnapshot } from "@/app/api/admin/map-layout/_shared";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-shop-location",
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { user, role, adminClient } = auth;

    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "リクエストの形が正しくありません" }, { status: 400 });
    }
    const parsed = parseShopLocation(body);
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

    let locationId = existing?.id as string | undefined;
    if (locationId) {
      const { error } = await adminClient
        .from("market_locations")
        .update({ latitude: lat, longitude: lng })
        .eq("id", locationId);
      if (error) return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
    } else {
      const { data, error } = await adminClient
        .from("market_locations")
        .insert({ store_number: storeNumber, latitude: lat, longitude: lng })
        .select("id")
        .single();
      if (error || !data) return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
      locationId = data.id;
    }

    // この店舗の以前の店番と、この店番の以前の持ち主（force のとき）を外してから置く
    const { error: clearVendorError } = await adminClient.from("location_assignments").delete().eq("vendor_id", id);
    const { error: clearLocationError } = await adminClient.from("location_assignments").delete().eq("location_id", locationId!);
    if (clearVendorError || clearLocationError) {
      return NextResponse.json({ error: "店番の割り当てを更新できませんでした" }, { status: 500 });
    }
    const { error: assignError } = await adminClient
      .from("location_assignments")
      .insert({ location_id: locationId!, vendor_id: id, market_date: new Date().toISOString().slice(0, 10) });
    if (assignError) return NextResponse.json({ error: "店番の割り当てを保存できませんでした" }, { status: 500 });

    const ip = getClientIp(request);
    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_location_edit",
        targetType: "vendor",
        targetId: id,
        targetName: (vendor.shop_name ?? id).slice(0, 500),
        details: `店番 ${storeNumber} に配置（${lat.toFixed(6)}, ${lng.toFixed(6)}）${force ? " / 別の店舗の割り当てを上書き" : ""}`,
        ipAddress: ip !== "unknown" ? ip : null,
      },
    );

    revalidatePublicShops();
    return NextResponse.json({ ok: true, storeNumber });
  } catch {
    return NextResponse.json({ error: "位置を保存できませんでした" }, { status: 500 });
  }
}
