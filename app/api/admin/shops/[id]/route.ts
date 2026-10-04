import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { parseShopEdit } from "@/lib/admin/shopEdit";
import { isEndAfterStart } from "@/lib/vendor/businessHours";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// select の列は文字列リテラルで渡す（連結すると、Supabase の型推論が効かなくなる）
const DETAIL_COLUMNS =
  "id, shop_name, category_id, style, strength, main_products, main_product_prices, payment_methods, rain_policy, sns_instagram, sns_x, sns_hp, business_hours_start, business_hours_end, shop_image_url, listing_status, photo_use_allowed, listing_consented_on, listing_consent_note, updated_at" as const;

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

  const [{ data: owner }, { data: assignment }] = await Promise.all([
    adminClient.from("vendor_owner_profiles").select("owner_name").eq("vendor_id", id).maybeSingle(),
    adminClient
      .from("location_assignments")
      .select("location_id, market_locations(store_number)")
      .eq("vendor_id", id)
      .maybeSingle(),
  ]);

  const location = assignment?.market_locations as { store_number: number } | { store_number: number }[] | null | undefined;
  const storeNumber = Array.isArray(location) ? location[0]?.store_number : location?.store_number;

  return NextResponse.json({
    shop: { ...vendor, owner_name: owner?.owner_name ?? null, store_number: storeNumber ?? null },
  });
}

/** 運営の代理編集。送られた項目だけを更新する（掲載許可の記録もここ） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    // 現地で何度も保存するので、バルク操作より緩め
    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-shop-edit",
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

    const parsed = parseShopEdit(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { vendor: update, ownerName } = parsed.value;

    const { data: current, error: currentError } = await adminClient
      .from("vendors")
      .select("shop_name, listing_status, listing_consented_on, business_hours_start, business_hours_end")
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

    // 許可済みにするとき、許可日が未記録なら今日にする（「いつ許可を得たか」を辿れるように）。
    // 記録済みの日付は上書きしない
    if (update.listing_status === "allowed" && update.listing_consented_on === undefined && !current.listing_consented_on) {
      update.listing_consented_on = new Date().toISOString().slice(0, 10);
    }

    if (Object.keys(update).length > 0) {
      const { error } = await adminClient
        .from("vendors")
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
    }

    if (ownerName !== undefined) {
      // 店主名の公開可否（is_public）は出店者本人が決める。ここでは触らず、行がなければ非公開で作る
      const { error } = await adminClient
        .from("vendor_owner_profiles")
        .upsert({ vendor_id: id, owner_name: ownerName }, { onConflict: "vendor_id" });
      if (error) return NextResponse.json({ error: "店主名を保存できませんでした" }, { status: 500 });
    }

    const ip = getClientIp(request);
    const changed = [...Object.keys(update), ...(ownerName !== undefined ? ["owner_name"] : [])];
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
        ipAddress: ip !== "unknown" ? ip : null,
      },
    );

    // 来訪者のマップ・検索のキャッシュに反映する
    revalidatePublicShops();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  }
}
