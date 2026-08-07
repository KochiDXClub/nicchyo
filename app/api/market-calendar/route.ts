import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { fetchMarketCalendar } from "@/lib/market/calendar";

export const dynamic = "force-dynamic";

/**
 * 日曜市カレンダーの公開読み取り。
 * 開催ステータス（market_days）と今日以降のイベント（market_events）を1本で返す。
 * どちらも RLS で公開が許可された行だけが読める（書き込みは admin のみ）。
 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  try {
    const calendar = await fetchMarketCalendar(supabase);
    // 認可判定を含まない完全公開レスポンスなので CDN キャッシュを効かせる。
    // マップと近況ページの両方がマウント毎に叩く経路のため、素通しだと DB 負荷が高い。
    return NextResponse.json(calendar, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
