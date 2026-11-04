import { createAnnouncement, listAnnouncements } from "@/lib/announcements/announcementRoutes.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 運営向け: サイト内のお知らせの一覧（公開前・終了・非公開も含めて新しい順） */
export async function GET() {
  return listAnnouncements("admin");
}

/** サイト内のお知らせを投稿する */
export async function POST(request: Request) {
  return createAnnouncement(request, "admin");
}
