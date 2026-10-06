import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 店舗とログインアカウントの対応（shop_members）を、管理画面の API から引く。
 *
 * 店舗は、運営がアカウントなしで先に作り、出店者があとから QR で紐づく。そのため
 * 「店舗の ID = アカウントの ID」とは限らず、アカウントが 1 つもない店舗もある。
 * 管理画面の API は、店舗の ID で auth.users を引かず、必ずここで対応を引くこと。
 */

export type ShopAccountLinks = {
  /** 店舗 ID → 代表者のアカウント ID（代表者がいない店舗は入らない） */
  ownerByVendor: Map<string, string>;
  /** 店舗 ID → その店舗のメンバー全員（代表者を含む）のアカウント ID */
  membersByVendor: Map<string, string[]>;
  /** アカウント ID → その人が入っている店舗の ID */
  vendorByUser: Map<string, string>;
};

/** vendorIds を省くと、全店舗分を引く */
export async function loadShopAccountLinks(
  db: SupabaseClient,
  vendorIds?: readonly string[],
): Promise<{ links: ShopAccountLinks; error: string | null }> {
  let query = db.from("shop_members").select("vendor_id, user_id, role");
  if (vendorIds) query = query.in("vendor_id", [...vendorIds]);
  const { data, error } = await query;

  const links: ShopAccountLinks = { ownerByVendor: new Map(), membersByVendor: new Map(), vendorByUser: new Map() };
  if (error) return { links, error: error.message };

  for (const row of data ?? []) {
    const vendorId = row.vendor_id as string;
    const userId = row.user_id as string;
    links.membersByVendor.set(vendorId, [...(links.membersByVendor.get(vendorId) ?? []), userId]);
    links.vendorByUser.set(userId, vendorId);
    if (row.role === "owner") links.ownerByVendor.set(vendorId, userId);
  }
  return { links, error: null };
}
