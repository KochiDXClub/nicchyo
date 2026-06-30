/**
 * 投稿の有効期限として使う「今週の日曜23:59:59」を返す。
 * 日曜日に呼ばれた場合は当日の23:59:59（今夜）を返す。
 */
export function getNextSundayExpiry(): Date {
  const now = new Date();
  const daysUntilSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}
