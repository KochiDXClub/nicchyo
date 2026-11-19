import { createAdminServiceClientOrNull } from "@/lib/auth/requireAdminApi";
import { toIsoDate } from "@/lib/market/calendar";
import { jstWeekday } from "@/lib/market/marketPick";
import type { PublicMarket } from "@/lib/market/publicMarkets.server";
import type { Landmark } from "@/app/(public)/map/types/landmark";

export async function fetchMarketPeople(
  markets: PublicMarket[],
  now = new Date(),
): Promise<Landmark[]> {
  const db = createAdminServiceClientOrNull();
  if (!db || markets.length === 0) return [];

  const today = jstWeekday(now);
  const ids = markets.map(({ id }) => id);
  const [people, days] = await Promise.all([
    db.from("map_people_illustrations")
      .select("id,market_id,image_url,latitude,longitude,width_px,markets!inner(is_public)")
      .eq("enabled", true).eq("markets.is_public", true)
      .in("market_id", ids).contains("weekdays", [today]).order("id"),
    db.from("market_days").select("market_id,status")
      .eq("market_date", toIsoDate(now)).in("market_id", ids),
  ]);
  if (people.error || days.error) return [];

  const hiddenMarketIds = new Set(days.data
    .filter(({ status }) => status !== "open" && status !== "special")
    .map(({ market_id }) => market_id));

  return people.data.filter(({ market_id }) => !hiddenMarketIds.has(market_id)).map((row) => ({
    key: `people:${row.id}`,
    name: "",
    description: "",
    url: row.image_url,
    lat: row.latitude,
    lng: row.longitude,
    widthPx: row.width_px,
    heightPx: row.width_px,
    showAtMinZoom: false,
    decorative: true,
  }));
}
