import { NextRequest, NextResponse } from "next/server";
import { toLocale } from "@/lib/i18n/config";
import { fetchPublicShopData } from "@/app/(public)/map/services/shopCache";
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
    const { shops, profiles } = await fetchPublicShopData(locale);
    // 出店予定と識別子の切替後に古い場所番号の一覧が残らないよう、CDN に保存しない。
    return NextResponse.json(
      { shops, profiles },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ shops: [] }, { status: 500 });
  }
}
