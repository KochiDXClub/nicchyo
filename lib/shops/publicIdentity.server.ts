import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { createAnonClient } from "@/lib/supabase/anonClient";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { readScheduleRows } from "@/lib/market-schedule/read.server";
import { readPublicScheduleRollout } from "@/lib/market-schedule/rollout.server";

type Alias = { legacy_shop_id: number; vendor_id: string | null };
type Identity = { id: string; public_shop_id: number };
/** 確認済みかつ公開ポリシーを通る店舗の対応だけを返す。 */
export async function readPublicLegacyIdentities(): Promise<{ enabled: boolean; aliases: Record<string, number> }> {
  if (!(await readPublicScheduleRollout())) return { enabled: false, aliases: {} };
  const admin = createAdminClient() as unknown as SupabaseClient | null;
  const anon = createAnonClient();
  if (!admin || !anon) throw new Error("公開店舗の対応を取得できません");
  const [rawAliases, revocations, publicVendors] = await Promise.all([
    readScheduleRows(admin, "legacy_shop_identity_aliases", "legacy_shop_id,vendor_id", ["legacy_shop_id"]),
    readScheduleRows(admin, "legacy_shop_identity_revocations", "legacy_shop_id", ["legacy_shop_id"]),
    fetchAllRows<Identity>((from, to) => anon.from("vendors").select("id,public_shop_id").order("id").range(from, to), { label: "public vendor identities" }),
  ]);
  if (publicVendors.error) throw new Error("公開店舗の対応を取得できません");
  const ids = new Map((publicVendors.data ?? []).map((row) => [row.id, row.public_shop_id]));
  const aliases: Record<string, number> = {};
  const revoked = new Set(revocations.map((row) => Number(row.legacy_shop_id)));
  for (const row of rawAliases as unknown as Alias[]) {
    if (revoked.has(row.legacy_shop_id)) continue;
    const id = row.vendor_id ? ids.get(row.vendor_id) : undefined;
    if (Number.isSafeInteger(id) && (id as number) >= 1000) aliases[String(row.legacy_shop_id)] = id as number;
  }
  return { enabled: true, aliases };
}
