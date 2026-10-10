import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { createAdminServiceClientOrNull as createAdminClient } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type InboxCounts = {
  /** 未読の通知 */
  notifications: number;
  /** 未対応の通報（open / in_review。ダッシュボードの「未対応の通報」と同じ数え方） */
  reports: number;
  /** 未対応の問い合わせ（open / in_progress。ダッシュボードの「未対応の問い合わせ」と同じ数え方） */
  inquiries: number;
};

/**
 * 受信トレイの新着の件数（サイドバーとタブの赤いバッジ用）。
 * 通知・通報・問い合わせの各 API と同じく、moderator 以上だけが見られる。
 * 数えられなかった種類は 0 にする（バッジが出ないだけで、画面は止めない）。
 */
export async function GET() {
  const supabase = createServerClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const [notifications, reports, inquiries] = await Promise.all([
    dc.from("admin_notifications").select("*", { count: "exact", head: true }).eq("is_read", false),
    dc.from("reports").select("*", { count: "exact", head: true }).in("status", ["open", "in_review"]),
    dc.from("inquiries").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
  ]);

  const counts: InboxCounts = {
    notifications: notifications.error ? 0 : (notifications.count ?? 0),
    reports: reports.error ? 0 : (reports.count ?? 0),
    inquiries: inquiries.error ? 0 : (inquiries.count ?? 0),
  };
  return NextResponse.json(counts);
}
