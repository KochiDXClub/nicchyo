import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getUpcomingSundayIso,
  normalizeStatus,
  type MarketDay,
} from "./calendar";

/**
 * トップページ用の開催カレンダー（今週の日曜の状態と、これからの日曜の状態）。
 *
 * 開催ステータス（market_days）は全員に同じ公開データなので、Cookie を持たない anon クライアントで読み、
 * Next.js のデータキャッシュに載せる。Cookie を使うとトップが毎回の動的描画になり、
 * 検索や口コミで最初に来る入口の表示が遅くなる。
 * 雨天中止などの当日の変更が届くまでの遅れが、この秒数までに収まるようにしておく。
 */
const PUBLIC_CALENDAR_REVALIDATE_SECONDS = 5 * 60;

export type PublicMarketCalendar = {
  /** 今週の日曜の開催ステータス。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  /** 今週の日曜から先の開催ステータス */
  days: MarketDay[];
};

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 引数の sundayIso がキャッシュのキーにも入るので、週が替わると取り直される
const getCachedDays = unstable_cache(
  async (sundayIso: string): Promise<MarketDay[]> => {
    const supabase = createAnonClient();
    if (!supabase) throw new Error("Supabase の環境変数が未設定です");
    const { data, error } = await supabase
      .from("market_days")
      .select("market_date, status, note")
      .gte("market_date", sundayIso)
      .order("market_date", { ascending: true })
      .limit(12);
    // 取れなかったときはキャッシュさせない（その間ずっと「予定なし」に見えるため）
    if (error) throw new Error(`開催カレンダーの取得に失敗しました: ${error.message}`);
    return (data ?? []).map((row) => ({
      market_date: row.market_date,
      status: normalizeStatus(row.status),
      note: row.note,
    }));
  },
  ["landing-market-days-v1"],
  { revalidate: PUBLIC_CALENDAR_REVALIDATE_SECONDS }
);

/** 取れなかったときは null（呼び出し側は「開催」として出す。カレンダーページと同じ扱い） */
export async function fetchPublicMarketCalendar(
  now: Date = new Date()
): Promise<PublicMarketCalendar | null> {
  try {
    const sundayIso = getUpcomingSundayIso(now);
    const days = await getCachedDays(sundayIso);
    return { day: days.find((d) => d.market_date === sundayIso) ?? null, days };
  } catch (error) {
    console.warn("[fetchPublicMarketCalendar] 取得できませんでした:", error);
    return null;
  }
}
