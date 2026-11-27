import {
  addDaysToIso,
  isEventOnSunday,
  normalizeStatus,
  type MarketDayStatus,
  type MarketEvent,
} from "./calendar";

/**
 * 月カレンダー（運営の日曜市カレンダー画面）の純粋ロジック。
 *
 * 日曜市は毎週日曜だけ開くため、開催日の判定は「日曜かどうか」で行う。
 * 予定の振り分けは一覧（日曜ごとのカード）と同じ isEventOnSunday を使い、
 * 月カレンダーと一覧で予定の出る日がずれないようにする。
 */

export type MonthCell = {
  dateIso: string;
  day: number;
  /** 表示中の月に含まれるか。前後の月の日付は空けて描く */
  inMonth: boolean;
  /** 日曜市の開催日（日曜）か */
  isMarketDay: boolean;
};

export type MonthDayTone = "none" | "open" | "alert" | "highlight";

export type MonthDayInfo = {
  dateIso: string;
  isMarketDay: boolean;
  status: MarketDayStatus | null;
  tone: MonthDayTone;
  events: MarketEvent[];
};

function isoParts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** 年・月（1〜12）から、日曜始まりの週の配列（6行または5行）を作る */
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const first = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leading = new Date(`${first}T00:00:00Z`).getUTCDay();
  const weeks = Math.ceil((leading + daysInMonth) / 7);
  const start = addDaysToIso(first, -leading);

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, column) => {
      const dateIso = addDaysToIso(start, week * 7 + column);
      const parts = isoParts(dateIso);
      return {
        dateIso,
        day: parts.day,
        inMonth: parts.month === month && parts.year === year,
        isMarketDay: column === 0,
      };
    })
  );
}

/** 表示中の月の、前の月・次の月（年と月）を返す */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** 中止・休市は警戒（赤）、特別開催は目立たせ、平常の開催は淡く塗る */
export function toneForStatus(status: MarketDayStatus | null, isMarketDay: boolean): MonthDayTone {
  if (!isMarketDay) return "none";
  if (status === "cancelled" || status === "closed") return "alert";
  if (status === "special") return "highlight";
  return "open";
}

/**
 * 1日分の表示情報をまとめる。
 * 開催日でない日（日曜以外）は予定も開催状況も持たない。
 * 予定は一覧と同じ isEventOnSunday で、その日曜に載るものだけを拾う。
 */
export function getMonthDayInfo<T extends MarketEvent>(
  dateIso: string,
  events: T[],
  days: { market_date: string; status: string }[]
): MonthDayInfo & { events: T[] } {
  const isMarketDay = new Date(`${dateIso}T00:00:00Z`).getUTCDay() === 0;
  if (!isMarketDay) {
    return { dateIso, isMarketDay, status: null, tone: "none", events: [] };
  }
  const row = days.find((d) => d.market_date === dateIso);
  const status = row ? normalizeStatus(row.status) : "open";
  return {
    dateIso,
    isMarketDay,
    status,
    tone: toneForStatus(status, isMarketDay),
    events: events.filter((event) => isEventOnSunday(event, dateIso)),
  };
}
