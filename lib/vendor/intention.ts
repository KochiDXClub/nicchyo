import { z } from "zod";

/**
 * 出店意向調査（来季、出店したい場所）。
 * 保存先は vendor_intention_seasons / vendor_intention_responses
 * （supabase/migrations/20261124100000_create_vendor_intention_surveys.sql と、その後の 20261124110000_narrow_vendor_intention_to_place.sql）。
 * 出店したい場所は market_locations（地図の区画番号）から1つ選ぶ。
 */

export const IntentionPlaceInputSchema = z.object({
  placeId: z.string().uuid("出店したい場所を選んでください"),
});

export type IntentionPlaceInput = z.infer<typeof IntentionPlaceInputSchema>;

/** 出店者が選べる場所（区画番号の昇順） */
export type IntentionPlace = {
  id: string;
  storeNumber: number;
  name: string | null;
};

export type IntentionPlaceRow = {
  id: string;
  store_number: number;
  place_name: string | null;
};

export const INTENTION_PLACE_COLUMNS = "id, store_number, place_name";

export function rowToIntentionPlace(row: IntentionPlaceRow): IntentionPlace {
  return { id: row.id, storeNumber: row.store_number, name: row.place_name };
}

/** 画面に出す名前（例: 「12番」「12番（追手筋側）」） */
export function intentionPlaceLabel(place: IntentionPlace): string {
  return place.name ? `${place.storeNumber}番（${place.name}）` : `${place.storeNumber}番`;
}

export type IntentionSeason = {
  seasonYear: number;
  title: string;
  /** 受付の開始日（日本時間の YYYY-MM-DD） */
  opensOn: string;
  /** 受付の最終日（同上。この日まで変更できる） */
  closesOn: string;
};

export type IntentionSeasonRow = {
  season_year: number;
  title: string;
  opens_on: string;
  closes_on: string;
};

export const INTENTION_SEASON_COLUMNS = "season_year, title, opens_on, closes_on";

export function rowToIntentionSeason(row: IntentionSeasonRow): IntentionSeason {
  return {
    seasonYear: row.season_year,
    title: row.title,
    opensOn: row.opens_on,
    closesOn: row.closes_on,
  };
}

/** 受付期間の中か（日付は YYYY-MM-DD の文字列で比べられる） */
export function isIntentionSeasonOpen(season: IntentionSeason, todayJst: string): boolean {
  return todayJst >= season.opensOn && todayJst <= season.closesOn;
}

export type IntentionResponse = {
  seasonYear: number;
  placeId: string;
  updatedAt: string;
};

export type IntentionResponseRow = {
  season_year: number;
  place_id: string;
  updated_at: string;
};

export const INTENTION_RESPONSE_COLUMNS = "season_year, place_id, updated_at";

export function rowToIntentionResponse(row: IntentionResponseRow): IntentionResponse {
  return {
    seasonYear: row.season_year,
    placeId: row.place_id,
    updatedAt: row.updated_at,
  };
}
