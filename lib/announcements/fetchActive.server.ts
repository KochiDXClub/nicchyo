import { createAdminClient } from "@/lib/supabase/adminClient";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import {
  isAnnouncementActive,
  localizeAnnouncement,
  sortAnnouncements,
  toAnnouncement,
  type AnnouncementRow,
  type PublicAnnouncement,
} from "./schema";

/** 地図ページの上部に出す最大件数（それ以上は /news で見てもらう） */
export const BANNER_MAX = 3;

const BASE_COLUMNS = "id, title, body, important, published, starts_at, ends_at, created_at, updated_at";
const COLUMNS = `${BASE_COLUMNS}, title_en, body_en`;

/**
 * 来訪者に見せるお知らせ（公開にしてあって、公開期間内のもの）。重要なものを先に、新しい順。
 * テーブルは service_role だけが読めるので、サーバー側のここで絞ってから渡す。
 * `locale` が英語で英語版があれば英語の文面を返す（無ければ日本語のまま。`lang` で見分ける）。
 * 読めなかったとき（テーブルが無い・通信失敗）は空にする。お知らせが出ないだけで、ページは止めない。
 */
export async function fetchActiveAnnouncements(
  now: Date = new Date(),
  locale: Locale = DEFAULT_LOCALE
): Promise<PublicAnnouncement[]> {
  try {
    const client = createAdminClient();
    if (!client) return [];
    const query = (columns: string) =>
      client
        .from("site_announcements")
        .select(columns)
        .eq("published", true)
        .lte("starts_at", now.toISOString())
        .order("starts_at", { ascending: false })
        .limit(100);
    let { data, error } = await query(COLUMNS);
    // 英語版の列を足すマイグレーションより先にデプロイされても、日本語のお知らせは出し続ける
    if (error?.code === "42703") ({ data, error } = await query(BASE_COLUMNS));
    if (error || !data) return [];

    return sortAnnouncements(
      (data as unknown as AnnouncementRow[]).map(toAnnouncement).filter((a) => isAnnouncementActive(a, now))
    ).map((a) => ({
      id: a.id,
      ...localizeAnnouncement(a, locale),
      important: a.important,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    }));
  } catch {
    return [];
  }
}
