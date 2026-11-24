/**
 * 出店意向調査のサーバー側の読み書き（service_role）。
 * 店舗の範囲と権限は呼び出し側（API）で確かめてから使う。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { todayJstString } from "@/lib/time/jstDate";
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

/** 場所が存在するか（保存の前に確かめて、存在しない場所を 400 で返す） */
export async function intentionPlaceExists(db: SupabaseClient, placeId: string): Promise<boolean> {
  const { data, error } = await db.from("market_locations").select("id").eq("id", placeId).maybeSingle();
  if (error) throw error;
  return data !== null;
}
