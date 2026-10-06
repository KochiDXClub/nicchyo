/**
 * 営業時間（出店時間）の選択肢と、時刻の文字列の扱い。
 *
 * 保存の形は「H:MM」（例 "7:00" "7:30"）。これまでの「7:00」の形のまま、10 分刻みにした。
 * 日曜市は早朝から始まるので 5:00 から、24:00（夜中の 0 時）まで選べる。
 */
export const TIME_STEP_MINUTES = 10;
export const FIRST_HOUR = 5;
export const LAST_HOUR = 24;

/** 選べる「時」（5〜24） */
export const TIME_HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

/** 選べる「分」（0, 10, 20, 30, 40, 50） */
export const TIME_MINUTES = Array.from({ length: 60 / TIME_STEP_MINUTES }, (_, i) => i * TIME_STEP_MINUTES);

/** 時刻を保存の形にする（"7:00" "7:30"） */
export function formatTime(hour: number, minute = 0): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

/** 選べる時刻（5:00, 5:10, … 23:50, 24:00） */
export const TIME_OPTIONS: string[] = [
  ...TIME_HOURS.filter((h) => h < LAST_HOUR).flatMap((h) => TIME_MINUTES.map((m) => formatTime(h, m))),
  formatTime(LAST_HOUR, 0),
];

/** 「H:MM」を時と分に分ける。選べる時刻でなければ null（古い形式・空・範囲外） */
export function parseTime(value: string | null | undefined): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return TIME_OPTIONS.includes(formatTime(hour, minute)) ? { hour, minute } : null;
}

/** 0 時からの分。選べる時刻でなければ null */
export function timeToMinutes(value: string | null | undefined): number | null {
  const time = parseTime(value);
  return time ? time.hour * 60 + time.minute : null;
}

/** 終わりが始まりより後か（どちらかが選べる時刻でなければ false） */
export function isEndAfterStart(start: string | null | undefined, end: string | null | undefined): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s !== null && e !== null && e > s;
}
