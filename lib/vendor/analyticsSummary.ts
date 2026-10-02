// 出店者の「お店の分析」で出す数字の、集計と言い回し。画面（app/vendor/analytics）と
// 取得（app/vendor/_services/analyticsService.ts）から使う純粋なロジック。

export type ViewRow = { viewed_at: string; source: string | null };

export type HourlyCount = { hour: number; views: number };

export type SourceShare = { map: number; search: number; direct: number };

/** 時間帯の棒グラフの、最低限出す範囲（日曜市の朝〜昼）。この外に閲覧があれば広げる */
const BASE_FIRST_HOUR = 6;
const BASE_LAST_HOUR = 15;

/** 閲覧を1時間ごとに数える。範囲は 6〜15時を基本に、外にも閲覧があればそこまで広げる */
export function hourlyCounts(rows: readonly ViewRow[]): HourlyCount[] {
  const byHour = new Map<number, number>();
  for (const row of rows) {
    const hour = new Date(row.viewed_at).getHours();
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const hoursWithViews = [...byHour.keys()];
  const first = Math.min(BASE_FIRST_HOUR, ...hoursWithViews);
  const last = Math.max(BASE_LAST_HOUR, ...hoursWithViews);
  return Array.from({ length: last - first + 1 }, (_, i) => ({
    hour: first + i,
    views: byHour.get(first + i) ?? 0,
  }));
}

/** いちばん見られた時間。閲覧が無ければ null、同数なら早いほう */
export function peakHour(hourly: readonly HourlyCount[]): HourlyCount | null {
  let peak: HourlyCount | null = null;
  for (const item of hourly) {
    if (item.views > 0 && (!peak || item.views > peak.views)) peak = item;
  }
  return peak;
}

/** 流入元ごとの件数。source が無い・知らない値は direct に寄せる */
export function sourceShares(rows: readonly ViewRow[]): SourceShare {
  const counts: SourceShare = { map: 0, search: 0, direct: 0 };
  for (const row of rows) {
    if (row.source === "map") counts.map++;
    else if (row.source === "search") counts.search++;
    else counts.direct++;
  }
  return counts;
}

/** 先週との違いを一言にする。先週が 0 のときは割合を出さない（0 で割れないので） */
export function describeChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "先週もまだ記録がありません" : "先週は 0回でした";
  const diff = current - previous;
  if (diff === 0) return "先週と同じです";
  return `先週より ${Math.abs(diff).toLocaleString("ja-JP")}回${diff > 0 ? "多い" : "少ない"}です`;
}
