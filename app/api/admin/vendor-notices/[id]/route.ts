import { deleteNotice } from "@/lib/vendor/noticeRoutes.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE: お知らせを取り下げる（出店者の「確認しました」も一緒に消える） */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return deleteNotice(request, params, "admin");
}
