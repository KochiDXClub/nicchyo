// /admin/content の表示ロジックのうち、DOM/Reactに依存しない純粋な部分を切り出す。

export type DbStatus = "active" | "hidden" | "deleted";
export type DisplayStatus = "active" | "expired" | "hidden";

/**
 * DB上のstatus（active/hidden/deleted）と有効期限から、管理画面での表示状態を算出する。
 * hidden は期限内外に関わらず優先して「非表示」として表示する
 * （非表示にした投稿が期限切れになっても、それは「非表示」のままであるべきなため）。
 */
export function computeDisplayStatus(
  dbStatus: DbStatus,
  expiresAt: string,
  now: Date = new Date()
): DisplayStatus {
  if (dbStatus === "hidden") return "hidden";
  return new Date(expiresAt) > now ? "active" : "expired";
}
