/**
 * 今週（当日を含む）の日曜日の Date を返す。
 * 日曜日に呼ばれた場合は当日を返す。
 */
function getThisSunday(): Date {
  const now = new Date();
  const daysUntilSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return sunday;
}

/**
 * 投稿の有効期限として使う「今週の日曜23:59:59」を返す。
 * 日曜日に呼ばれた場合は当日の23:59:59（今夜）を返す。
 */
export function getNextSundayExpiry(): Date {
  const sunday = getThisSunday();
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * 次の日曜日の表示用ラベル（例: 7/6（日））を返す。
 * 日曜日に呼ばれた場合は当日の日付を返す。
 */
export function getNextSundayLabel(): string {
  const sunday = getThisSunday();
  return `${sunday.getMonth() + 1}/${sunday.getDate()}（日）`;
}

const jstDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });

/** 「2026年10月3日」の形（日本時間）。端末のタイムゾーンによらず、日本の日付で出す。不正な値は "" */
export function formatJaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return jstDate.format(date);
}

/** 「10月3日 14:05」の形。操作ログや招待リンクの期限など、いつ起きたかを短く出すとき用 */
export function formatJaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  // toLocaleString は環境によって「10/3 14:05」のように形が変わるので、自分で組み立てる
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
}
