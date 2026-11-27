import { z } from "zod";
import { CHOMES, normalizeChomeId, type ChomeId } from "@/lib/map/chomes";

/**
 * 出店意向調査（来季、出店したい場所）。
 * 保存先は vendor_intention_seasons / vendor_intention_responses
 * （supabase/migrations/20261124100000_create_vendor_intention_surveys.sql、その後の 20261124110000・20261127130000）。
 *
 * 出店者は、まず丁目（1〜7）を選ぶ。そのあと、丁目の中の場所（地図の点＝区画）を選べる。
 * 丁目だけでも回答できる（場所は任意）。
 */

export const INTENTION_CHOME_IDS: readonly ChomeId[] = CHOMES.map((chome) => chome.id);

export const IntentionChomeInputSchema = z.object({
  chome: z
    .number({ message: "出店したい丁目を選んでください" })
    .int()
    .min(1, "出店したい丁目を選んでください")
    .max(7, "出店したい丁目を選んでください"),
  /** 場所は任意。入れるときは、その丁目の場所にする */
  placeId: z.string().uuid("出店したい場所を選び直してください").nullable().optional(),
});

export type IntentionChomeInput = z.infer<typeof IntentionChomeInputSchema>;

/** 出店者が選べる場所（区画番号の昇順）。地図の点の位置（lat/lng）と丁目を持つ */
export type IntentionPlace = {
  id: string;
  storeNumber: number;
  name: string | null;
  /** 丁目（分からなければ null） */
  chome: ChomeId | null;
  lat: number | null;
  lng: number | null;
};

export type IntentionPlaceRow = {
  id: string;
  store_number: number;
  place_name: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
};

export const INTENTION_PLACE_COLUMNS = "id, store_number, place_name, district, latitude, longitude";

export function rowToIntentionPlace(row: IntentionPlaceRow): IntentionPlace {
  return {
    id: row.id,
    storeNumber: row.store_number,
    name: row.place_name,
    chome: normalizeChomeId(row.district),
    lat: row.latitude === null ? null : Number(row.latitude),
    lng: row.longitude === null ? null : Number(row.longitude),
  };
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
  chome: ChomeId;
  /** 場所まで選んだときだけ入る */
  placeId: string | null;
  updatedAt: string;
};

export type IntentionResponseRow = {
  season_year: number;
  chome: number;
  place_id: string | null;
  updated_at: string;
};

export const INTENTION_RESPONSE_COLUMNS = "season_year, chome, place_id, updated_at";

export function rowToIntentionResponse(row: IntentionResponseRow): IntentionResponse {
  return {
    seasonYear: row.season_year,
    chome: row.chome as ChomeId,
    placeId: row.place_id,
    updatedAt: row.updated_at,
  };
}
