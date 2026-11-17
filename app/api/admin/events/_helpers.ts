import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 見どころにする日付の配列を検証する。
 * event_date〜(end_date ?? event_date) の範囲内かをチェックし、
 * 重複を除いて日付順に並べて返す。
 */
export function validateHighlightDates(
  value: unknown,
  eventDate: string,
  endDate: string | null
): { dates: string[]; error: string | null } {
  if (value === undefined || value === null) return { dates: [], error: null };
  if (!Array.isArray(value)) return { dates: [], error: "見どころの日付が無効です" };

  const rangeEnd = endDate && endDate > eventDate ? endDate : eventDate;
  const dates: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || !DATE_PATTERN.test(v)) {
      return { dates: [], error: "見どころの日付の形式が無効です（YYYY-MM-DD）" };
    }
    if (v < eventDate || v > rangeEnd) {
      return { dates: [], error: "見どころの日付は開催期間内にしてください" };
    }
    dates.push(v);
  }

  return { dates: Array.from(new Set(dates)).sort(), error: null };
}

/**
 * 指定した日付のいずれかが、他の予定の見どころとして既に使われていないか調べる。
 * 1つの日曜につき見どころは1件までのため、重複があれば衝突している予定を返す。
 *
 * DB制約（部分ユニーク索引）ではなくアプリ側チェックにしているのは、
 * 見どころが date[] 列になり「特定の日付が重複しているか」を宣言的な
 * 制約で表現しづらいため。低頻度更新の管理画面なので競合の実害は小さい。
 *
 * 既知の限界：このチェックとinsert/updateの間はトランザクションで
 * 保護されていないため、理論上は同時更新で重複した見どころが登録され得る
 * （TOCTOU）。管理画面の更新頻度・利用者数を踏まえて許容している。
 * 将来、複数運営者が同時に編集するようになった場合は再検討する。
 */
export async function findHighlightConflict(
  dc: SupabaseClient<Database>,
  dates: string[],
  excludeId?: string
): Promise<{ id: string; title: string } | null> {
  if (dates.length === 0) return null;
  let query = dc.from("market_events").select("id, title").overlaps("highlight_dates", dates);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.limit(1);
  return data && data.length > 0 ? (data[0] as { id: string; title: string }) : null;
}

// カード画像のURL検証は日曜市カレンダー全体で共通のため lib/market に置く
export { MARKET_EVENT_IMAGE_PREFIX, validateImageUrl } from "@/lib/market/marketEventImage";


/**
 * ここに同名の実装がもう1つあった（categories/_helpers.ts と一字一句同じ）。
 * 共通の場所（lib/auth/requireAdminApi.ts）に1本化し、ここでは
 * import 元を変えずに済むよう re-export だけする
 */
export { authorizeAdmin } from "@/lib/auth/requireAdminApi";
