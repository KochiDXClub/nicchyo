import { NextRequest, NextResponse } from "next/server";
import { toLocale } from "@/lib/i18n/config";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";
import { isPathVisibleToCurrentUser } from "@/lib/pageVisibility/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // proxy.ts で止めたうえで、ここでも確認する（地図と同じ公開設定に従う）
  if (!(await isPathVisibleToCurrentUser("/map"))) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  // 言語は URL の ?locale= で決める（CDN にキャッシュされるので、Cookie ではなく URL で分ける）
  const locale = toLocale(request.nextUrl.searchParams.get("locale"));
  const hasSupabaseEnv =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  if (!hasSupabaseEnv) {
    return NextResponse.json({ shops: [] }, { status: 503 });
  }

  try {
    const shops = await fetchPublicShops(locale);
    // 認可判定を含まない公開データなので CDN にもキャッシュさせる。
    // 投稿の出入りが最大 5 分遅れるが、この API はお気に入り・相談履歴の復元用で許容できる
    return NextResponse.json(
      { shops },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ shops: [] }, { status: 500 });
  }
}
