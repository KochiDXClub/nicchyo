import { NextResponse } from "next/server";
import { fetchActiveAnnouncements } from "@/lib/announcements/fetchActive.server";
import { publicCacheHeaders } from "@/lib/http/cacheHeaders";
import { toLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
// ISR（revalidate）のルートは request.url のクエリが取り除かれ、?locale= が効かなくなるので使わない。
// CDN には Cache-Control で 60 秒だけ置く（公開期間の切り替わりも、最大1分で反映される）
export const dynamic = "force-dynamic";

/**
 * 来訪者向け: 公開中のサイト内のお知らせ。地図ページ上部のバナーが読む。
 * `?locale=en` で英語版（無いお知らせは日本語のまま）。ロケールごとに URL が分かれるので CDN のキャッシュは混ざらない
 */
export async function GET(request: Request) {
  const locale = toLocale(new URL(request.url).searchParams.get("locale"));
  return NextResponse.json(
    { announcements: await fetchActiveAnnouncements(new Date(), locale) },
    { headers: publicCacheHeaders({ maxAgeSeconds: 0, sMaxAgeSeconds: 60 }) }
  );
}
