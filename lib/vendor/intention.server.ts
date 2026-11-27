/**
 * 出店意向調査のサーバー側の読み書き（service_role）。
 * 店舗の範囲と権限は呼び出し側（API）で確かめてから使う。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { todayJstString } from "@/lib/time/jstDate";
import { summariseIntentions, type IntentionSummary, type IntentionSummaryRow } from "./intentionSummary";
import {
  INTENTION_PLACE_COLUMNS,
  INTENTION_RESPONSE_COLUMNS,
  INTENTION_SEASON_COLUMNS,
  rowToIntentionPlace,
  rowToIntentionResponse,
  rowToIntentionSeason,
  type IntentionPlace,
  type IntentionPlaceRow,
  type IntentionResponseRow,
  type IntentionSeason,
  type IntentionSeasonRow,
} from "./intention";

/** vendor_intention_* は生成済み Database 型に未登録のため、型は付けずに扱う（notices と同じ） */
export function intentionDb(): SupabaseClient | null {
  return createAdminClient() as unknown as SupabaseClient | null;
}

/** 今日（日本時間）を含む受付期間。なければ null */
export async function findOpenIntentionSeason(db: SupabaseClient, today = todayJstString()): Promise<IntentionSeason | null> {
  const { data, error } = await db
    .from("vendor_intention_seasons")
    .select(INTENTION_SEASON_COLUMNS)
    .lte("opens_on", today)
    .gte("closes_on", today)
    .order("opens_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToIntentionSeason(data as IntentionSeasonRow) : null;
}

/** 最新の季節（集計の既定。受付が終わっていても見られる） */
export async function findLatestIntentionSeason(db: SupabaseClient): Promise<IntentionSeason | null> {
  const { data, error } = await db
    .from("vendor_intention_seasons")
    .select(INTENTION_SEASON_COLUMNS)
    .order("season_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToIntentionSeason(data as IntentionSeasonRow) : null;
}

export async function readOwnIntentionResponse(db: SupabaseClient, seasonYear: number, vendorId: string) {
  const { data, error } = await db
    .from("vendor_intention_responses")
    .select(INTENTION_RESPONSE_COLUMNS)
    .eq("season_year", seasonYear)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToIntentionResponse(data as IntentionResponseRow) : null;
}

/** 全季節（運営の管理画面用。新しい季節から並ぶ） */
export async function listIntentionSeasons(db: SupabaseClient): Promise<IntentionSeason[]> {
  const { data, error } = await db
    .from("vendor_intention_seasons")
    .select(INTENTION_SEASON_COLUMNS)
    .order("season_year", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as IntentionSeasonRow[]).map(rowToIntentionSeason);
}

/** 出店者が選べる場所（区画番号の昇順） */
export async function listIntentionPlaces(db: SupabaseClient): Promise<IntentionPlace[]> {
  const { data, error } = await db
    .from("market_locations")
    .select(INTENTION_PLACE_COLUMNS)
    .order("store_number", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as IntentionPlaceRow[]).map(rowToIntentionPlace);
}

/**
 * 店舗が今出店している場所（初期選択に使う）。出店場所の登録（vendors.market_place_id）を先に見て、
 * なければ出店場所の所属（market_place_memberships）から取る。どちらも無ければ null。
 */
export async function readVendorCurrentPlaceId(db: SupabaseClient, vendorId: string): Promise<string | null> {
  const { data: vendor, error: vendorError } = await db
    .from("vendors")
    .select("market_place_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (vendorError) throw vendorError;
  const registered = (vendor as { market_place_id: string | null } | null)?.market_place_id ?? null;
  if (registered) return registered;

  const { data: membership, error: membershipError } = await db
    .from("market_place_memberships")
    .select("location_id")
    .eq("vendor_id", vendorId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  return (membership as { location_id: string } | null)?.location_id ?? null;
}

/** 場所を1件読む（丁目の確かめにも使う）。無ければ null */
export async function findIntentionPlace(db: SupabaseClient, placeId: string): Promise<IntentionPlace | null> {
  const { data, error } = await db
    .from("market_locations")
    .select(INTENTION_PLACE_COLUMNS)
    .eq("id", placeId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToIntentionPlace(data as IntentionPlaceRow) : null;
}

/**
 * 季節の集計を読む。運営（mask: false）と市役所（mask: true）で同じ読み方を使う。
 * 回答は丁目と場所の2つだけを読み、店舗ごとの情報は返さない。
 */
export async function loadIntentionSummary(
  db: SupabaseClient,
  seasonYear: number,
  options: { mask: boolean },
): Promise<IntentionSummary> {
  // PostgREST の既定の上限（1,000 件）で切れると集計が狂うので、全件をページングして読む
  const result = await fetchAllRows<IntentionSummaryRow>(
    (from, to) =>
      db
        .from("vendor_intention_responses")
        .select("vendor_id, chome, place_id")
        .eq("season_year", seasonYear)
        .order("vendor_id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: IntentionSummaryRow[] | null; error: { message: string } | null }>,
    { label: "vendor_intention_responses" },
  );
  if (result.error || result.truncated) throw new Error("vendor_intention_responses の読み込みに失敗");

  const places = await listIntentionPlaces(db);
  return summariseIntentions(result.data, places, { mask: options.mask });
}
