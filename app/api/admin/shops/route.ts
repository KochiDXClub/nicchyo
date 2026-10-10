import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { guardAdminWrite } from "@/lib/admin/shopApiGuard";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { isMissingTableError } from "@/lib/admin/fieldShopLocation";
import { listAllAuthUsers } from "@/lib/auth/listAllUsers";
import { loadShopAccountLinks } from "@/lib/admin/shopAccounts.server";
import { parseShopEdit, type ListingStatus } from "@/lib/admin/shopEdit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AdminShop = {
  id: string;
  name: string;
  category: string;
  owner: string;
  email: string;
  status: "active" | "suspended";
  /** 掲載許可（pending=未取得 / allowed=許可済み / declined=断られた） */
  listingStatus: ListingStatus;
  /** 店番。現場登録の記録があればそれ、無ければ地図上の区画の店番。無ければ null */
  storeNumber: number | null;
  /** 位置が決まっているか（現場で位置を記録した、または地図上の区画に置かれている） */
  hasLocation: boolean;
  /** 店舗写真があるか */
  hasPhoto: boolean;
  registeredDate: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;
    const { adminClient: serviceClient } = auth;

    // vendors + categories を取得
    const { data: vendorsData, error: vendorsError } = await serviceClient
      .from("vendors")
      .select("id, shop_name, created_at, listing_status, shop_image_url, categories(name)");

    if (vendorsError) {
      return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
    }

    // 店主名は vendors から分離済み。管理画面は service_role のため
    // 公開設定にかかわらず全件取得できる。
    const { data: ownerProfilesData } = await serviceClient
      .from("vendor_owner_profiles")
      .select("vendor_id, owner_name");
    const ownerNameByVendorId = new Map<string, string>(
      (ownerProfilesData ?? [])
        .filter((row): row is { vendor_id: string; owner_name: string } => !!row.owner_name)
        .map((row) => [row.vendor_id, row.owner_name])
    );

    const vendors = Array.isArray(vendorsData) ? vendorsData : [];

    // 店番（現地で位置を決めたかの目印）。取れなくても一覧は出す
    const [{ data: assignmentRows }, { data: locationRows }] = await Promise.all([
      serviceClient.from("location_assignments").select("vendor_id, location_id"),
      serviceClient.from("market_locations").select("id, store_number"),
    ]);
    const storeNumberByLocation = new Map((locationRows ?? []).map((l) => [l.id, l.store_number]));
    const storeNumberByVendor = new Map<string, number>();
    for (const a of assignmentRows ?? []) {
      const n = storeNumberByLocation.get(a.location_id);
      if (n != null) storeNumberByVendor.set(a.vendor_id, n);
    }

    // 現場登録の記録（地図には反映していない）。店番が決まっていない新しい店舗も、位置を記録していれば「位置あり」
    const fieldRows = new Map<string, { store_number: number | null; latitude: number | null }>();
    const fieldResult = await serviceClient.from("field_shop_locations").select("vendor_id, store_number, latitude");
    if (fieldResult.error && !isMissingTableError(fieldResult.error)) {
      console.error("[admin/shops] field_shop_locations error:", fieldResult.error);
    }
    for (const row of fieldResult.data ?? []) fieldRows.set(row.vendor_id, row);

    // 全 auth ユーザーを取得（banned_until でsuspended判定）
    // ページ途中で取得に失敗しても、それまでに取れた分は使う（一部の店舗情報が
    // 欠けるだけで、店舗一覧全体が空になるよりはましなため）
    const usersResult = await listAllAuthUsers(serviceClient);
    if (usersResult.error) {
      console.error("[admin/shops] listAllAuthUsers partial failure:", usersResult.error);
    }
    const allAuthUsers = usersResult.users;

    const authById = new Map(allAuthUsers.map((u) => [u.id, u]));

    // 店舗は、アカウントがなくても存在する（運営が先に作り、出店者があとから QR で紐づく）。
    // 代表者のアカウントは shop_members から引き、店舗の ID で auth.users を引かない
    const { links, error: linkError } = await loadShopAccountLinks(serviceClient as unknown as SupabaseClient);
    if (linkError) {
      // 失敗したのに続けると、全店舗が「未紐づけ」と表示されてしまう
      console.error("[admin/shops] loadShopAccountLinks error:", linkError);
      return NextResponse.json({ error: "店舗とアカウントの対応を取得できませんでした" }, { status: 500 });
    }

    const shops: AdminShop[] = vendors.map((vendor) => {
      const ownerAccountId = links.ownerByVendor.get(vendor.id);
      const authUser = ownerAccountId ? authById.get(ownerAccountId) : undefined;
      const bannedUntil = authUser?.banned_until ? new Date(authUser.banned_until) : null;
      const isSuspended =
        bannedUntil !== null && !Number.isNaN(bannedUntil.getTime()) && bannedUntil > new Date();

      const categoryName =
        vendor.categories && typeof vendor.categories === "object" && !Array.isArray(vendor.categories)
          ? (vendor.categories as { name: string | null }).name ?? "未分類"
          : Array.isArray(vendor.categories) && vendor.categories.length > 0
          ? (vendor.categories[0] as { name: string | null }).name ?? "未分類"
          : "未分類";

      return {
        id: vendor.id,
        name: vendor.shop_name ?? "名称未設定",
        category: categoryName,
        owner:
          ownerNameByVendorId.get(vendor.id) ??
          authUser?.email?.split("@")[0] ??
          (ownerAccountId ? "-" : "未紐づけ"),
        email: authUser?.email ?? "-",
        status: isSuspended ? "suspended" : "active",
        listingStatus: vendor.listing_status as ListingStatus,
        storeNumber: fieldRows.get(vendor.id)?.store_number ?? storeNumberByVendor.get(vendor.id) ?? null,
        hasLocation:
          fieldRows.get(vendor.id)?.latitude != null ||
          fieldRows.get(vendor.id)?.store_number != null ||
          storeNumberByVendor.has(vendor.id),
        hasPhoto: !!vendor.shop_image_url,
        registeredDate: formatDate(authUser?.created_at ?? vendor.created_at),
      };
    });

    return NextResponse.json({ shops });
  } catch {
    return NextResponse.json({ error: "Failed to load shops" }, { status: 500 });
  }
}

/**
 * 店舗の新規登録（現場登録）。住所録（2024年版）に無い店舗を、運営が現地で作る。
 * 作った店舗は掲載許可が「未取得」（pending）なので、許可を取って「許可済み」にするまで来訪者には出ない。
 * 店番・位置・丁目は、作ったあとに現場登録の画面で記録する（地図には反映しない）。
 */
export async function POST(request: Request) {
  try {
    const guard = await guardAdminWrite(request, { bucket: "admin-shop-create", limit: 60, json: true });
    if ("error" in guard) return guard.error;
    const { user, role, adminClient, ip } = guard.ctx;

    const body = guard.body as Record<string, unknown> | null;
    // 店名・カテゴリの検証は、代理編集と同じ規則を使う
    const parsed = parseShopEdit({ shop_name: body?.shop_name, category_id: body?.category_id ?? null });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { shop_name, category_id } = parsed.value.vendor;
    if (!shop_name) return NextResponse.json({ error: "店名を入力してください" }, { status: 400 });

    const { data: created, error } = await adminClient
      .from("vendors")
      .insert({ id: crypto.randomUUID(), shop_name, category_id: category_id ?? null, listing_status: "pending" })
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: "店舗を作れませんでした" }, { status: 500 });

    await logAdminAudit(
      adminClient,
      { id: user.id, email: user.email, role },
      {
        action: "shop_create",
        targetType: "vendor",
        targetId: created.id,
        targetName: shop_name.slice(0, 500),
        details: "現場登録で新規作成（掲載許可は未取得）",
        ipAddress: ip,
      },
    );

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "店舗を作れませんでした" }, { status: 500 });
  }
}
