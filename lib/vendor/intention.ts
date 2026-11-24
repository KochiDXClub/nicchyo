import { z } from "zod";

/**
 * 出店意向調査（来季の出店の希望）。
 * 保存先は vendor_intention_seasons / vendor_intention_responses
 * （supabase/migrations/20261124100000_create_vendor_intention_surveys.sql）。値域はテーブルの CHECK 制約とそろえること。
 */

export const INTENTION_BOOTH_COUNTS = [1, 2, 3] as const;
export type IntentionBoothCount = (typeof INTENTION_BOOTH_COUNTS)[number];

export const INTENTION_FREQUENCIES = ["weekly", "twice_monthly", "monthly", "seasonal", "undecided"] as const;
export type IntentionFrequency = (typeof INTENTION_FREQUENCIES)[number];

export const INTENTION_FREQUENCY_LABELS: Record<IntentionFrequency, string> = {
  weekly: "毎週",
  twice_monthly: "月に2回ほど",
  monthly: "月に1回ほど",
  seasonal: "季節だけ（春など）",
  undecided: "まだ決めていない",
};

export const INTENTION_NOTE_MAX = 200;

export const INTENTION_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const IntentionInputSchema = z.object({
  boothCount: z.union([z.literal(1), z.literal(2), z.literal(3)], { message: "区画数を選んでください" }),
  frequency: z.enum(INTENTION_FREQUENCIES, { message: "出店の頻度を選んでください" }),
  preferredMonths: z
    .array(z.number().int().min(1).max(12))
    .max(12, "月は12個までです"),
  note: z
    .string()
    .trim()
    .max(INTENTION_NOTE_MAX, `ひとことは${INTENTION_NOTE_MAX}文字以内です`)
    .nullish(),
});

export type IntentionInput = z.infer<typeof IntentionInputSchema>;

/** 入力を保存できる形に整える（月は重複を除いて昇順、空のひとことは null） */
export function normalizeIntentionInput(input: IntentionInput): IntentionInput {
  const months = [...new Set(input.preferredMonths)].sort((a, b) => a - b);
  const note = input.note?.trim() ? input.note.trim() : null;
  return { ...input, preferredMonths: months, note };
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
  boothCount: IntentionBoothCount;
  frequency: IntentionFrequency;
  preferredMonths: number[];
  note: string | null;
  updatedAt: string;
};

export type IntentionResponseRow = {
  season_year: number;
  booth_count: number;
  frequency: string;
  preferred_months: number[] | null;
  note: string | null;
  updated_at: string;
};

export const INTENTION_RESPONSE_COLUMNS = "season_year, booth_count, frequency, preferred_months, note, updated_at";

export function rowToIntentionResponse(row: IntentionResponseRow): IntentionResponse {
  return {
    seasonYear: row.season_year,
    boothCount: row.booth_count as IntentionBoothCount,
    frequency: row.frequency as IntentionFrequency,
    preferredMonths: [...(row.preferred_months ?? [])].sort((a, b) => a - b),
    note: row.note,
    updatedAt: row.updated_at,
  };
}
