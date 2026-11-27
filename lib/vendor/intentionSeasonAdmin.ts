/**
 * 出店意向調査の受付期間（vendor_intention_seasons）を運営が管理するための、純粋な判定とパターン。
 * DB には触れない（API 層が読み書きする）。日付は日本時間の YYYY-MM-DD の文字列で比べる。
 */
import { z } from "zod";
import { addDaysToDateString } from "@/lib/time/jstDate";
import type { IntentionSeason } from "./intention";

export const SEASON_YEAR_MIN = 2000;
export const SEASON_YEAR_MAX = 2100;
export const SEASON_TITLE_MAX = 80;

/** 実在する日付か（2026-02-30 などを弾く） */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 受付期間の形として正しいか。問題があれば利用者に見せる文言を返す */
export function validateSeasonWindow(opensOn: string, closesOn: string): string | null {
  if (!isCalendarDate(opensOn)) return "受付の開始日を確かめてください";
  if (!isCalendarDate(closesOn)) return "受付の締切日を確かめてください";
  if (closesOn < opensOn) return "締切日は開始日と同じか、それより後にしてください";
  return null;
}

/**
 * 季節の作成入力。運営は名前・開始日・締切日だけを入れる。
 * 季節の年は開始日の年から決める（例: 2026-12-01 開始 → 2026年の季節）。
 */
export const SeasonCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "名前を入力してください")
      .max(SEASON_TITLE_MAX, `名前は${SEASON_TITLE_MAX}文字以内にしてください`),
    opensOn: z.string(),
    closesOn: z.string(),
  })
  .superRefine((value, ctx) => {
    const message = validateSeasonWindow(value.opensOn, value.closesOn);
    if (message) ctx.addIssue({ code: "custom", message, path: [isCalendarDate(value.opensOn) ? "closesOn" : "opensOn"] });
  })
  .transform((value, ctx) => {
    const seasonYear = Number(value.opensOn.slice(0, 4));
    if (seasonYear < SEASON_YEAR_MIN || seasonYear > SEASON_YEAR_MAX) {
      ctx.addIssue({
        code: "custom",
        message: `開始日は${SEASON_YEAR_MIN}年から${SEASON_YEAR_MAX}年の間にしてください`,
        path: ["opensOn"],
      });
      return z.NEVER;
    }
    return { ...value, seasonYear };
  });

export type SeasonCreateInput = z.infer<typeof SeasonCreateSchema>;

/** 2つの期間が重なるか（両端を含む。日付は YYYY-MM-DD なので文字列で比べられる） */
export function windowsOverlap(a: { opensOn: string; closesOn: string }, b: { opensOn: string; closesOn: string }): boolean {
  return a.opensOn <= b.closesOn && b.opensOn <= a.closesOn;
}

/**
 * 新しい（または変えた）期間が、ほかの季節の期間と重なっていないか。
 * 出店者側は「今日を含む期間」を1つ選んで回答を受けるので、重なると回答先が決まらなくなる。
 * `ignoreYear` は、いま変えている季節自身を除くために使う。
 */
export function findOverlappingSeason(
  window: { opensOn: string; closesOn: string },
  seasons: IntentionSeason[],
  ignoreYear?: number,
): IntentionSeason | null {
  return seasons.find((season) => season.seasonYear !== ignoreYear && windowsOverlap(window, season)) ?? null;
}

export type SeasonStatus = "upcoming" | "open" | "closed";

/** 今日（日本時間）から見た受付の状態 */
export function seasonStatus(season: IntentionSeason, todayJst: string): SeasonStatus {
  if (todayJst < season.opensOn) return "upcoming";
  if (todayJst > season.closesOn) return "closed";
  return "open";
}

/** 「今すぐ受付を開く」: 開始を今日にし、締切は今日より前なら今日まで延ばす */
export function windowForOpenNow(season: IntentionSeason, todayJst: string): { opensOn: string; closesOn: string } {
  return {
    opensOn: todayJst,
    closesOn: season.closesOn >= todayJst ? season.closesOn : todayJst,
  };
}

/**
 * 「今すぐ受付を閉じる」: 締切を昨日にする（今日は受け付けない）。
 * 開始日が締切より後になるなら、開始日も昨日に合わせる（期間の形を保つため）。
 */
export function windowForCloseNow(season: IntentionSeason, todayJst: string): { opensOn: string; closesOn: string } {
  const yesterday = addDaysToDateString(todayJst, -1);
  const closesOn = season.closesOn < yesterday ? season.closesOn : yesterday;
  const opensOn = season.opensOn <= closesOn ? season.opensOn : closesOn;
  return { opensOn, closesOn };
}
