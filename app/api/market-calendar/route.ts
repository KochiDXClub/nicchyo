import { NextResponse } from "next/server";
import { loadPublicMarketCalendar } from "@/lib/market/calendar.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const calendar = await loadPublicMarketCalendar();
    // 公開設定を切り替えたときに、CDN に残った非公開の市を返さない。
    return NextResponse.json(calendar, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
