import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { listAllAuthUsers } from "@/lib/auth/listAllUsers";
import { loadShopAccountLinks } from "@/lib/admin/shopAccounts.server";
import type { ListingStatus } from "@/lib/admin/shopEdit";

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
  /** 配置されている店番。位置が未登録なら null */
  storeNumber: number | null;
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
        storeNumber: storeNumberByVendor.get(vendor.id) ?? null,
        hasPhoto: !!vendor.shop_image_url,
        registeredDate: formatDate(authUser?.created_at ?? vendor.created_at),
      };
    });

    return NextResponse.json({ shops });
  } catch {
    return NextResponse.json({ error: "Failed to load shops" }, { status: 500 });
  }
}
