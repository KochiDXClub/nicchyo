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
