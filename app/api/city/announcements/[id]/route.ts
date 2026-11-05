import { deleteAnnouncement, updateAnnouncement } from "@/lib/announcements/announcementRoutes.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** サイト内のお知らせを更新する（公開の切り替え・取り下げも、全項目を送って更新する） */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return updateAnnouncement(request, params, "city");
}

/** サイト内のお知らせを削除する */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteAnnouncement(request, params, "city");
}
