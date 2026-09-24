import { NextResponse } from "next/server";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
    return NextResponse.json({ shops: [] }, { status: 503 });
  }

  try {
    const shops = await fetchPublicShops();
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
