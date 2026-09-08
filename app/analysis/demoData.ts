/**
 * 分析ページのデモ用サンプルデータ。
 *
 * ここにあるのは **すべて架空の値** で、実測でも実データでもない。
 * 「このページで何がどう見えるようになるか」を関係者と共有するための見本として置いている。
 * 実装の方針と、実際に何を出すつもりなのかは docs/discussion-analytics-open-data.md を参照。
 *
 * 表示側では必ず <DemoBadge /> を添えること。デモ値が実データと混ざって見えると、
 * このページが目指している「正確で、偏りを開示したデータ」の逆をやることになる。
 *
 * 値は日付文字列からの決定的なハッシュで作っており、乱数は使っていない
 * （サーバ再レンダリングのたびに数字が変わると、デモとしても読めなくなるため）。
 */

import type { MarketStatus } from "./chart";

export const DEMO_NOTE = "サンプル値です。実データではありません。";

/** FNV-1a。同じ入力からは常に同じ 0〜1 を返す。 */
function hashUnit(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0xffffffff;
}

function isoOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

// ── 開催実績（market_days のデモ） ──────────────────────────────────────

export type DemoMarketDay = { date: string; status: MarketStatus };

/**
 * todayIso までの過去 years 年分の日曜日を作り、それらしい開催ステータスを振る。
 * 梅雨と台風期は中止を出やすく、よさこいの週と年始は休市、年末年始は特別開催にしている。
 */
/** 月ごとの荒天中止の起きやすさ。梅雨と台風期に寄せる。 */
function cancelWeight(month: number) {
  if (month === 6) return 2.2;
  if (month === 9) return 2.0;
  if (month === 8) return 1.9;
  if (month === 7) return 1.3;
  if (month === 10) return 1.2;
  return 1;
}

/**
 * todayIso までの過去 years 年分の日曜日を作り、それらしい開催ステータスを振る。
 *
 * 中止は「日ごとに独立して抽選する」とやめた。独立抽選だと年ごとのばらつきが大きすぎて、
 * 中止 0.0% の年と 19% の年が並んでしまい、見本として読めなくなる。
 * 年ごとに中止の回数（2〜5回）を先に決め、梅雨と台風期に重みを付けて、その年の中から選ぶ。
 */
export function buildDemoMarketDays(todayIso: string, years = 5): DemoMarketDay[] {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const cursor = new Date(Date.UTC(today.getUTCFullYear() - (years - 1), 0, 1));
  while (cursor.getUTCDay() !== 0) cursor.setUTCDate(cursor.getUTCDate() + 1);

  const byYear = new Map<string, { date: string; month: number }[]>();
  for (; cursor <= today; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    const date = isoOf(cursor);
    const year = date.slice(0, 4);
    const entry = { date, month: cursor.getUTCMonth() + 1 };
    const list = byYear.get(year);
    if (list) list.push(entry);
    else byYear.set(year, [entry]);
  }

  const result: DemoMarketDay[] = [];
  byYear.forEach((sundays, year) => {
    const fixed = new Map<string, MarketStatus>();
    const candidates: { date: string; weight: number }[] = [];

    sundays.forEach(({ date, month }) => {
      const dayOfMonth = Number(date.slice(8, 10));
      // よさこい期間（8月中旬）と年始は休市
      if ((month === 8 && dayOfMonth >= 9 && dayOfMonth <= 15) || (month === 1 && dayOfMonth <= 4)) {
        fixed.set(date, "closed");
        return;
      }
      // 年末最終日曜と、年明け最初の開催は特別開催
      if ((month === 12 && dayOfMonth >= 25) || (month === 1 && dayOfMonth >= 5 && dayOfMonth <= 11)) {
        fixed.set(date, "special");
        return;
      }
      candidates.push({ date, weight: hashUnit(date) * cancelWeight(month) });
    });

    // 年あたり 2〜5 回。まだ途中の年は、経過した日曜の割合で減らす。
    const fullYearTarget = 2 + Math.floor(hashUnit(`cancel-${year}`) * 4);
    const target = Math.min(
      candidates.length,
      Math.round(fullYearTarget * Math.min(1, sundays.length / 52))
    );
    const cancelled = new Set(
      candidates
        .slice()
        .sort((a, b) => b.weight - a.weight)
        .slice(0, target)
        .map((item) => item.date)
    );

    sundays.forEach(({ date }) => {
      result.push({
        date,
        status: fixed.get(date) ?? (cancelled.has(date) ? "cancelled" : "open"),
      });
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ── カバレッジ（実データが取れないときの見本） ─────────────────────────

export const DEMO_COVERAGE = {
  vendorTotal: 300,
  mainProducts: 128,
  hours: 96,
  payment: 74,
  rainPolicy: 61,
  landmarkTotal: 48,
  landmarkVerified: 31,
} as const;

// ── 時間帯 × 歩く向き（shop_interactions のデモ集計） ────────────────────

export type DemoHourlyDirection = {
  hour: number;
  /** 西（高知城側）へ向かう遷移数 */
  west: number;
  /** 東（はりまや橋側）へ向かう遷移数 */
  east: number;
};

/**
 * 早朝は東の電停側から入って西へ、昼前は高知城側から入って東へ、という
 * 時間帯で主な入口が入れ替わる想定のプロファイル。
 */
export const DEMO_HOURLY_DIRECTION: DemoHourlyDirection[] = [
  { hour: 5, west: 34, east: 12 },
  { hour: 6, west: 78, east: 31 },
  { hour: 7, west: 142, east: 74 },
  { hour: 8, west: 196, east: 168 },
  { hour: 9, west: 214, east: 287 },
  { hour: 10, west: 231, east: 352 },
  { hour: 11, west: 208, east: 341 },
  { hour: 12, west: 163, east: 244 },
  { hour: 13, west: 118, east: 149 },
  { hour: 14, west: 61, east: 72 },
  { hour: 15, west: 24, east: 26 },
];

/** 開催前（土曜夜〜日曜早朝）の下調べ利用。時間帯別の利用者数。 */
export const DEMO_PREVISIT_HOURS: { label: string; value: number }[] = [
  { label: "土 18時", value: 96 },
  { label: "土 20時", value: 184 },
  { label: "土 22時", value: 241 },
  { label: "日 0時", value: 88 },
  { label: "日 5時", value: 63 },
  { label: "日 6時", value: 129 },
  { label: "日 7時", value: 178 },
];

// ── 入口と到達率（丁目単位） ────────────────────────────────────────────

/** 西（高知城前）から東（はりまや橋側）の順。 */
export const DISTRICTS = ["六丁目", "五丁目", "四丁目", "三丁目", "二丁目", "一丁目"] as const;

export type DemoReachRow = {
  district: string;
  /** 最初にタップした店がこの丁目だった利用者の割合 */
  entryShare: number;
  /** この丁目まで到達した利用者の割合 */
  reachShare: number;
};

export const DEMO_REACH: DemoReachRow[] = [
  { district: "六丁目", entryShare: 0.312, reachShare: 0.584 },
  { district: "五丁目", entryShare: 0.178, reachShare: 0.712 },
  { district: "四丁目", entryShare: 0.161, reachShare: 0.868 },
  { district: "三丁目", entryShare: 0.142, reachShare: 0.913 },
  { district: "二丁目", entryShare: 0.108, reachShare: 0.746 },
  { district: "一丁目", entryShare: 0.099, reachShare: 0.427 },
];

/** 折り返し地点（最遠到達点）の分布。 */
export const DEMO_TURNAROUND: { district: string; share: number }[] = [
  { district: "六丁目", share: 0.128 },
  { district: "五丁目", share: 0.164 },
  { district: "四丁目", share: 0.231 },
  { district: "三丁目", share: 0.197 },
  { district: "二丁目", share: 0.153 },
  { district: "一丁目", share: 0.127 },
];

// ── カテゴリ × 丁目（出店構成のデモ） ───────────────────────────────────

export const DEMO_CATEGORY_MATRIX: { category: string; counts: number[] }[] = [
  { category: "野菜", counts: [14, 12, 9, 11, 13, 10] },
  { category: "果物", counts: [8, 11, 7, 6, 5, 4] },
  { category: "食べ物・惣菜", counts: [3, 4, 8, 9, 7, 6] },
  { category: "花・植木", counts: [6, 3, 2, 1, 2, 5] },
  { category: "刃物・金物", counts: [1, 1, 2, 3, 2, 1] },
  { category: "加工品", counts: [2, 3, 4, 3, 4, 3] },
  { category: "雑貨・古物", counts: [1, 2, 3, 4, 3, 2] },
];

// ── 旬カレンダー ────────────────────────────────────────────────────────

/** 0 = 出回らない / 1 = 出回る / 2 = 旬 */
export const DEMO_SEASON_CALENDAR: { product: string; months: number[] }[] = [
  { product: "土佐文旦", months: [1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1] },
  { product: "小夏", months: [0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0] },
  { product: "山北みかん", months: [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2] },
  { product: "新しょうが", months: [0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0] },
  { product: "四方竹", months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0] },
  { product: "ぶしゅかん", months: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 0, 0] },
  { product: "なす", months: [0, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0, 0] },
  { product: "いちご", months: [1, 2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1] },
];

// ── Web 来訪者数（実データが取れないときの見本） ───────────────────────

export type DemoVisitorDay = { date: string; value: number };

/**
 * 日ごとの来訪者数の見本。日曜市は日曜開催なので、日曜だけ大きく跳ねる形にする。
 * 平日は下調べや思い出しの利用で、日曜の1割前後に落ち着く想定。
 */
export function buildDemoVisitorDays(todayIso: string, days = 800): DemoVisitorDay[] {
  const cursor = new Date(`${todayIso}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - (days - 1));

  const result: DemoVisitorDay[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = isoOf(cursor);
    const isSunday = cursor.getUTCDay() === 0;
    const month = cursor.getUTCMonth() + 1;

    // 少しずつ増えていく想定（初期の 0.7 倍から等速で増やす）
    const growth = 0.7 + (i / days) * 0.6;
    // 春と秋に来訪が増え、真夏と真冬は落ちる
    const seasonal = 1 + 0.22 * Math.cos(((month - 4) / 12) * 2 * Math.PI);
    const noise = 0.82 + hashUnit(date) * 0.36;
    const base = isSunday ? 780 : 96;

    result.push({ date, value: Math.round(base * growth * seasonal * noise) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

// ── 定点観測（まだ実施していない） ──────────────────────────────────────

export type FieldSurveyPlan = {
  round: string;
  season: string;
  status: "planned";
};

/** 年4回・実測との突き合わせ用。1回目を実施するまでは、この枠だけを見せる。 */
export const FIELD_SURVEY_PLAN: FieldSurveyPlan[] = [
  { round: "第1回", season: "春（4月）", status: "planned" },
  { round: "第2回", season: "夏（7月）", status: "planned" },
  { round: "第3回", season: "秋（10月）", status: "planned" },
  { round: "第4回", season: "冬（1月）", status: "planned" },
];
