import { addDaysToDateString } from "@/lib/time/jstDate";
import { normalizeStatus, toIsoDate, type MarketDayStatus } from "./calendar";

/**
 * 開催ステータス（market_days）の入力検証。
 *
 * 運営（/api/admin/market-days）と高知市（/api/city/market-days）が同じ検証を通る。
 * 片方だけ緩む・厳しくなる、ということが起きないよう、ここ1箇所に置く。
 */

export const MARKET_DAY_STATUSES: readonly MarketDayStatus[] = [
  "open",
  "cancelled",
  "special",
  "closed",
];

/** 一言の最大文字数 */
export const MARKET_DAY_NOTE_MAX_LENGTH = 200;

export type MarketDayInput = {
  market_date: string;
  status: MarketDayStatus;
  note: string | null;
};

export function validateMarketDayInput(
  body: unknown
): { data: MarketDayInput; error: null } | { data: null; error: string } {
  if (!body || typeof body !== "object") return { data: null, error: "無効なリクエストです" };
  const b = body as Record<string, unknown>;

  const marketDate = typeof b.market_date === "string" ? b.market_date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) {
    return { data: null, error: "日付の形式が無効です（YYYY-MM-DD）" };
  }
  // 実在しない日付を弾く。Date は 2026-02-31 を 3/3 にロールオーバーして
  // Invalid にならないため、往復させて入力と一致するかで判定する。
  // JST 正午として解釈することで、toIsoDate（JST基準）と暦日がずれないようにする。
  const parsed = new Date(`${marketDate}T12:00:00+09:00`);
  if (Number.isNaN(parsed.getTime()) || toIsoDate(parsed) !== marketDate) {
    return { data: null, error: "存在しない日付です" };
  }
  const year = Number(marketDate.slice(0, 4));
  if (year < 2020 || year > 2100) {
    return { data: null, error: "日付が範囲外です" };
  }

  const status = typeof b.status === "string" ? b.status : "";
  if (!MARKET_DAY_STATUSES.includes(status as MarketDayStatus)) {
    return { data: null, error: "ステータスが無効です" };
  }

  return {
    data: {
      market_date: marketDate,
      status: normalizeStatus(status),
      note:
        typeof b.note === "string"
          ? b.note.trim().slice(0, MARKET_DAY_NOTE_MAX_LENGTH) || null
          : null,
    },
    error: null,
  };
}

/** 高知市が更新できるのは、今日から何週先の日曜までか */
export const CITY_MARKET_DAY_WEEKS_AHEAD = 8;

/**
 * 高知市が更新してよい日付か。今日から8週先までの日曜だけ。
 * 画面で選べるのは今後4回の日曜だけだが、API に直接送られても、過去の開催実績や
 * 遠い先の日付を書き換えられないようにする（運営は従来どおり広い範囲を扱える）。
 * 問題なければ null、だめなら画面に出せるエラー文を返す。
 */
export function validateCityMarketDate(marketDate: string, todayIso: string): string | null {
  const isSunday = new Date(`${marketDate}T00:00:00Z`).getUTCDay() === 0;
  if (!isSunday) return "日曜日の日付を指定してください";
  if (marketDate < todayIso) return "過去の日付は変更できません";
  if (marketDate > addDaysToDateString(todayIso, CITY_MARKET_DAY_WEEKS_AHEAD * 7)) {
    return "先すぎる日付は変更できません";
  }
  return null;
}
