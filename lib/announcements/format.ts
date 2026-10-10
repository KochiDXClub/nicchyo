const jstDate = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });

/** 「2026年10月12日」（日本時間） */
export function formatAnnouncementDate(iso: string): string {
  return jstDate.format(new Date(iso));
}

/** datetime-local の入力欄に入れる「2026-10-12T09:00」（日本時間）。空・不正は "" */
export function toJstInputValue(iso: string | null): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** datetime-local の値（日本時間として読む）を ISO にする。空は null、不正も null */
export function fromJstInputValue(value: string): string | null {
  if (!value) return null;
  const time = new Date(`${value}:00+09:00`).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}
