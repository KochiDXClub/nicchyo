import { NextResponse } from "next/server";
import { fetchActiveAnnouncements } from "@/lib/announcements/fetchActive.server";
import { toLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
// 60秒キャッシュ — CDN・ISR 両対応（公開期間の切り替わりも、最大1分で反映される）
export const revalidate = 60;

/**
 * 来訪者向け: 公開中のサイト内のお知らせ。地図ページ上部のバナーが読む。
 * `?locale=en` で英語版（無いお知らせは日本語のまま）。ロケールごとに URL が分かれるので CDN のキャッシュは混ざらない
 */
export async function GET(request: Request) {
  const locale = toLocale(new URL(request.url).searchParams.get("locale"));
  return NextResponse.json({ announcements: await fetchActiveAnnouncements(new Date(), locale) });
}
