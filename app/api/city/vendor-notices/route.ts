import { createNotice, listNotices } from "@/lib/vendor/noticeRoutes.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: 出したお知らせと、それぞれを確認した出店者の数 */
export async function GET(request: Request) {
  return listNotices(request, "city");
}

/** POST: お知らせを全出店者へ出す */
export async function POST(request: Request) {
  return createNotice(request, "city");
}
