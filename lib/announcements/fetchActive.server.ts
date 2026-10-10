import { createAdminClient } from "@/lib/supabase/adminClient";
import {
  isAnnouncementActive,
  sortAnnouncements,
  toAnnouncement,
  type AnnouncementRow,
  type PublicAnnouncement,
} from "./schema";

/** 地図ページの上部に出す最大件数（それ以上は /news で見てもらう） */
export const BANNER_MAX = 3;

/**
 * 来訪者に見せるお知らせ（公開にしてあって、公開期間内のもの）。重要なものを先に、新しい順。
 * テーブルは service_role だけが読めるので、サーバー側のここで絞ってから渡す。
 * 読めなかったとき（テーブルが無い・通信失敗）は空にする。お知らせが出ないだけで、ページは止めない。
 */
export async function fetchActiveAnnouncements(now: Date = new Date()): Promise<PublicAnnouncement[]> {
  try {
    const client = createAdminClient();
    if (!client) return [];
    const { data, error } = await client
      .from("site_announcements")
      .select("id, title, body, important, published, starts_at, ends_at, created_at, updated_at")
      .eq("published", true)
      .lte("starts_at", now.toISOString())
      .order("starts_at", { ascending: false })
      .limit(100);
    if (error || !data) return [];

    return sortAnnouncements(
      (data as AnnouncementRow[]).map(toAnnouncement).filter((a) => isAnnouncementActive(a, now))
    ).map(({ id, title, body, important, startsAt, endsAt }) => ({ id, title, body, important, startsAt, endsAt }));
  } catch {
    return [];
  }
}
