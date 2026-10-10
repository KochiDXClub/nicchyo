import { NextResponse } from "next/server";
import { fetchActiveAnnouncements } from "@/lib/announcements/fetchActive.server";

export const runtime = "nodejs";
// 60秒キャッシュ — CDN・ISR 両対応（公開期間の切り替わりも、最大1分で反映される）
export const revalidate = 60;

/** 来訪者向け: 公開中のサイト内のお知らせ。地図ページ上部のバナーが読む */
export async function GET() {
  return NextResponse.json({ announcements: await fetchActiveAnnouncements() });
}
