/**
 * 指定した日時（省略時は現在時刻）を Asia/Tokyo の日付として YYYY-MM-DD で返す。
 *
 * `new Date().toISOString().slice(0, 10)` 等はUTC基準になり、JST 0時〜8時59分
 * （UTCでは前日）がズレる。この関数だけを日付の基準にすることで、
 * 同じ形のIntl.DateTimeFormat呼び出しが各所で再実装され、フォールバック挙動が
 * 少しずつ食い違う（例: 取得できなかった項目を "01" で埋めるか例外を投げるか）
 * のを防ぐ。
 */
export function todayJstString(baseDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Failed to format JST date");
  }
  return `${year}-${month}-${day}`;
}
