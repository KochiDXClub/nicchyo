import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminShopWrite, UUID_RE } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { consentDateOnAllow, parseShopEdit } from "@/lib/admin/shopEdit";
import { purgeRemovedProducts } from "@/lib/admin/productImages";
import { normalizeChomeId } from "@/lib/map/chomes";
import { isMissingTableError } from "@/lib/admin/fieldShopLocation";
import { isEndAfterStart } from "@/lib/vendor/businessHours";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// select の列は文字列リテラルで渡す（連結すると、Supabase の型推論が効かなくなる）
const DETAIL_COLUMNS =
  "id, shop_name, category_id, categories(name), style, strength, main_products, main_product_prices, payment_methods, rain_policy, sns_instagram, sns_x, sns_hp, business_hours_start, business_hours_end, shop_image_url, listing_status, photo_use_allowed, listing_consented_on, listing_consent_note, updated_at" as const;

/**
 * 運営が現地で店舗を代理編集するための、店舗 1 件の取得。
 * 許可前（pending）の店舗も返す（service_role なので RLS を通らない）。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { adminClient } = auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data: vendor, error } = await adminClient
    .from("vendors")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "店舗を取得できませんでした" }, { status: 500 });
  if (!vendor) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

  const [{ data: owner }, { data: assignment }, productRows] = await Promise.all([
    adminClient.from("vendor_owner_profiles").select("owner_name").eq("vendor_id", id).maybeSingle(),
    adminClient
      .from("location_assignments")
      .select("location_id, market_locations(store_number)")
      .eq("vendor_id", id)
      .maybeSingle(),
    // 商品の写真（products の同じ名前の商品の行）。読めなくても店舗の取得は止めない
    adminClient.from("products").select("name, image_url").eq("vendor_id", id).not("image_url", "is", null),
  ]);
  const productImages: Record<string, string> = {};
  for (const row of productRows.data ?? []) if (row.image_url) productImages[row.name] = row.image_url;

  const location = assignment?.market_locations as { store_number: number } | { store_number: number }[] | null | undefined;
  const storeNumber = Array.isArray(location) ? location[0]?.store_number : location?.store_number;

  // 現場登録の記録（地図には反映していない）。あればそれを優先し、無ければ地図上の区画を見せる。
  // 記録のテーブルが無い DB（マイグレーション前）でも、店舗の取得は止めない
  let fieldRecord: { store_number: number | null; chome_id: number | null; latitude: number | null } | null = null;
  const fieldResult = await adminClient
    .from("field_shop_locations")
    .select("store_number, chome_id, latitude")
    .eq("vendor_id", id)
    .maybeSingle();
  if (!fieldResult.error) fieldRecord = fieldResult.data;
  else if (!isMissingTableError(fieldResult.error)) {
    return NextResponse.json({ error: "店舗を取得できませんでした" }, { status: 500 });
  }

  let mapChome: number | null = null;
  if (assignment?.location_id) {
    const mapLocation = await adminClient.from("market_locations").select("district").eq("id", assignment.location_id).maybeSingle();
    mapChome = normalizeChomeId(mapLocation.data?.district);
  }

  const { categories, ...fields } = vendor;
  const category = Array.isArray(categories) ? categories[0] : categories;

  return NextResponse.json({
    shop: {
      ...fields,
      category_name: (category as { name: string | null } | null | undefined)?.name ?? null,
      owner_name: owner?.owner_name ?? null,
      store_number: fieldRecord?.store_number ?? storeNumber ?? null,
      // 現場で位置（座標）を記録済みか。店番が無い新しい店舗でも、記録したかが分かるように
      location_recorded: fieldRecord?.latitude != null,
      chome: fieldRecord?.chome_id ?? mapChome,
      product_images: productImages,
    },
  });
}

/** 運営の代理編集。送られた項目だけを更新する（掲載許可の記録もここ） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 現地で何度も保存するので、バルク操作より緩め
    const guard = await guardAdminShopWrite(request, params, { bucket: "admin-shop-edit", limit: 120, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip, id } = guard.ctx;
    const body = guard.body;

    const parsed = parseShopEdit(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { vendor: update, ownerName, chome } = parsed.value;

    const { data: current, error: currentError } = await adminClient
      .from("vendors")
      .select("shop_name, main_products, listing_status, listing_consented_on, business_hours_start, business_hours_end, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (currentError) return NextResponse.json({ error: "店舗を取得できませんでした" }, { status: 500 });
    if (!current) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 });

    // 営業時間は、片方だけの更新でも、保存済みの相手側との前後を確かめる
    const start = update.business_hours_start !== undefined ? update.business_hours_start : current.business_hours_start;
    const end = update.business_hours_end !== undefined ? update.business_hours_end : current.business_hours_end;
    if (
      (update.business_hours_start !== undefined || update.business_hours_end !== undefined) &&
      start &&
      end
    ) {
      if (!isEndAfterStart(start, end)) {
        return NextResponse.json({ error: "終了時刻は開始時刻より後にしてください" }, { status: 400 });
      }
    }

    const consentedOn = consentDateOnAllow(update, current.listing_consented_on);
    if (consentedOn) update.listing_consented_on = consentedOn;

    // 画面を開いたあとに、ほかの運営（や出店者）が更新していたら、上書きせずに断る。
    // 全項目を送るので、気づかずに相手の許可状態やメモを戻してしまうのを防ぐ。
    // 画面が読み込んだときの updated_at（まだ一度も更新されていない店舗は null）を必ず送らせる
    const bodyRecord = body as Record<string, unknown>;
    const expectedUpdatedAt = bodyRecord.updated_at;
    if (!("updated_at" in bodyRecord) || (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== "string")) {
      return NextResponse.json({ error: "updated_at を送ってください（画面を開いたときの値）" }, { status: 400 });
    }
    const conflict = NextResponse.json(
      { error: "ほかの人が先にこの店舗を更新しました。開き直して、最新の内容で入れ直してください", code: "STALE" },
      { status: 409 },
    );
    const sameInstant = (a: string | null, b: string | null) =>
      a === b || (a !== null && b !== null && new Date(a).getTime() === new Date(b).getTime());
    if (!sameInstant(current.updated_at, expectedUpdatedAt as string | null)) return conflict;

    // 項目の更新がなく店主名だけのときも、updated_at を進めて同じ確認を通す
    let query = adminClient
      .from("vendors")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id);
    query = current.updated_at ? query.eq("updated_at", current.updated_at) : query.is("updated_at", null);
    const { data: updated, error: updateError } = await query.select("id");
    if (updateError) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
    if (!updated || updated.length === 0) return conflict;

    // 主な商品の一覧から外した商品は、写真ごと消す（残すと、全部外したあとに商品名だけ復活する）
    if (update.main_products !== undefined) {
      await purgeRemovedProducts(adminClient, id, current.main_products ?? [], update.main_products);
    }

    if (ownerName !== undefined) {
      // 店主名の公開可否（is_public）は出店者本人が決める。ここでは触らず、行がなければ非公開で作る
      const { error } = await adminClient
        .from("vendor_owner_profiles")
        .upsert({ vendor_id: id, owner_name: ownerName }, { onConflict: "vendor_id" });
      if (error) return NextResponse.json({ error: "店主名を保存できませんでした" }, { status: 500 });
    }

    if (chome !== undefined) {
      // 現場で聞いた丁目は記録として残すだけで、地図の区画（market_locations）は変えない
      const { error } = await adminClient
        .from("field_shop_locations")
        .upsert({ vendor_id: id, chome_id: chome, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "vendor_id" });
      if (error) return NextResponse.json({ error: "丁目を保存できませんでした" }, { status: 500 });
    }

    const changed = [
      ...Object.keys(update),
      ...(ownerName !== undefined ? ["owner_name"] : []),
      ...(chome !== undefined ? [`chome=${chome}`] : []),
    ];
    // 許可の変更は経緯を追えるよう、前後の値を残す。メモの中身は残さない（個人情報を含みうる）
    const consentChange =
      update.listing_status !== undefined && update.listing_status !== current.listing_status
        ? `掲載許可 ${current.listing_status} → ${update.listing_status}`
        : null;
    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_edit",
        targetType: "vendor",
        targetId: id,
        targetName: (update.shop_name ?? current.shop_name ?? id).slice(0, 500),
        details: [`代理編集: ${changed.join(", ")}`, consentChange].filter(Boolean).join(" / "),
        ipAddress: ip,
      },
    );

    // 来訪者のマップ・検索のキャッシュに反映する
    revalidatePublicShops();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
}
