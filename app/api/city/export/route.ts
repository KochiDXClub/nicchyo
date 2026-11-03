import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireCityApi } from "@/lib/auth/requireCityApi";
import { createClient } from "@/utils/supabase/server";
import { fetchCityDataset, isCityDatasetKind } from "@/lib/city/datasets.server";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { toCsv } from "@/lib/utils/csv";
import { todayJstString } from "@/lib/time/jstDate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 高知市向けの集計データ（CSV）。種別は visitors / market-days / categories だけ。
 * 取得は本人のセッション（RLS あり）で行い、service role は使わない。個票は含まない。
 */
export async function GET(req: NextRequest) {
  const auth = await requireCityApi();
  if ("error" in auth) return auth.error;

  const kind = req.nextUrl.searchParams.get("type");
  if (!isCityDatasetKind(kind)) {
    return NextResponse.json({ error: "無効なエクスポート種別です" }, { status: 400 });
  }

  const today = todayJstString();
  try {
    const supabase = createClient(await cookies());
    const dataset = await fetchCityDataset(supabase, kind, today);
    return new NextResponse(toCsv(dataset.rows, dataset.columns), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset.name}_${today}.csv"`,
        ...privateNoStoreHeaders(),
      },
    });
  } catch (e) {
    console.error("[city/export] fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
}
