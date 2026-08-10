import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";
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

/** アップロードAPIが書き込む場所。ここ以外のパスは受け付けない */
export const MARKET_EVENT_IMAGE_PREFIX =
  "/storage/v1/object/public/vendor-images/market-events/";

/**
 * カード画像のURLを検証する。
 *
 * 許可するのは「自プロジェクトのStorageの、アップロードAPIが書き込む場所」だけ。
 * `*.supabase.co` は誰でも取得できるサブドメインなので、ホスト名の後方一致で
 * 判定すると攻撃者のプロジェクトのURLが通り、公開カレンダーに任意の画像を
 * 配信されてしまう（保存後に差し替えも可能）。オリジン完全一致で塞ぐ。
 *
 * 完全一致にすることで next.config.js の remotePatterns（`*.supabase.co` は
 * 1ラベルのみマッチ）とのズレも消え、「検証は通るのに next/image が落ちる」
 * URLが保存されなくなる。ローカルの Supabase（127.0.0.1）でも同じ判定で通る。
 */
export function validateImageUrl(
  value: unknown
): { url: string | null; error: string | null } {
  if (value === null || value === undefined || value === "") return { url: null, error: null };
  if (typeof value !== "string") return { url: null, error: "画像URLが無効です" };

  const trimmed = value.trim();
  if (!trimmed) return { url: null, error: null };
  if (trimmed.length > 500) return { url: null, error: "画像URLが長すぎます" };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { url: null, error: "画像の保存先が設定されていません" };

  let allowedOrigin: string;
  try {
    allowedOrigin = new URL(base).origin;
  } catch {
    return { url: null, error: "画像の保存先の設定が不正です" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { url: null, error: "画像URLが無効です" };
  }

  const isOwnUpload =
    parsed.origin === allowedOrigin &&
    parsed.pathname.startsWith(MARKET_EVENT_IMAGE_PREFIX) &&
    // エンコードされた ../ でプレフィックスの外に出るのを防ぐ
    !/%2e/i.test(parsed.pathname) &&
    !parsed.pathname.includes("..") &&
    !parsed.search &&
    !parsed.hash;

  if (!isOwnUpload) {
    return { url: null, error: "画像はこのサイトからアップロードしたものだけ指定できます" };
  }

  return { url: trimmed, error: null };
}

export async function authorizeAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}
