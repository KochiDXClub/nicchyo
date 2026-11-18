import { createAdminClient } from "@/lib/supabase/adminClient";
import {
  addDaysToIso,
  getUpcomingSundayIso,
  normalizeCategory,
  normalizeHighlightDates,
  normalizeStatus,
  PUBLIC_CALENDAR_WEEKS,
  toIsoDate,
  type MarketCalendar,
} from "./calendar";
import { readPublicMarkets } from "./publicMarkets.server";

type Client = NonNullable<ReturnType<typeof createAdminClient>>;

/** 公開市場だけを読み、同じ日付の開催状況を市IDで混同しない。 */
export async function fetchMarketCalendar(
  supabase: Client,
  { now = new Date() }: { now?: Date } = {},
): Promise<MarketCalendar> {
  const todayIso = toIsoDate(now);
  const markets = await readPublicMarkets(supabase);
  if (markets.length === 0) return { todayIso, markets: [] };
  const marketIds = markets.map((market) => market.id);
  const through = addDaysToIso(todayIso, PUBLIC_CALENDAR_WEEKS.landing * 7 - 1);
  const eventFrom = markets.some((market) => market.slug === "nichiyo" && market.weekday === 0)
    ? addDaysToIso(getUpcomingSundayIso(now), -6)
    : todayIso;

  const [daysResult, eventsResult] = await Promise.all([
    supabase.from("market_days")
      .select("market_id,market_date,status,note,updated_at,markets!inner(is_public)")
      .in("market_id", marketIds).eq("markets.is_public", true)
      .gte("market_date", todayIso).lte("market_date", through)
      .order("market_date").order("market_id"),
    supabase.from("market_events")
      .select("market_id,id,title,description,event_date,end_date,start_time,end_time,location,category,image_url,highlight_dates,markets!inner(is_public)")
      .in("market_id", marketIds).eq("markets.is_public", true).eq("is_published", true)
      .lte("event_date", through)
      .or(`end_date.gte.${eventFrom},and(end_date.is.null,event_date.gte.${eventFrom})`)
      .order("event_date").order("id")
      .limit(50),
  ]);
  if (daysResult.error || eventsResult.error) throw new Error("開催情報を取得できませんでした");

  return {
    todayIso,
    markets: markets.map((market) => ({
      ...market,
      days: daysResult.data.filter((row) => row.market_id === market.id)
        .map(({ market_date, status, note, updated_at }) => ({ market_date, status: normalizeStatus(status), note, updated_at })),
      events: eventsResult.data.filter((row) => row.market_id === market.id)
        .map(({ markets: _market, market_id: _marketId, category, highlight_dates, ...event }) => ({
          ...event,
          category: normalizeCategory(category),
          highlight_dates: normalizeHighlightDates(highlight_dates),
        })),
    })),
  };
}

export async function loadPublicMarketCalendar(): Promise<MarketCalendar> {
  // market_id は既存の匿名向け列権限の対象外。サーバーで読み、公開条件と返却列をクエリで限定する。
  const supabase = createAdminClient();
  if (!supabase) throw new Error("開催情報を取得できませんでした");
  return fetchMarketCalendar(supabase);
}
