import type { ShopProfile } from "@/app/(public)/map/types/shopData";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { WEEKDAY_JA } from "@/lib/market/marketPick";

/**
 * 次の市での出店状況の一言。日曜市は従来の文言（次の日曜…）のまま。
 * 日曜市以外の市の店は、市名と曜日を出して、日曜に出るように読めないようにする。
 */
export function nextMarketStatusLabel(shop: ShopProfile, locale: Locale = "ja"): string | null {
  const other = shop.nextMarketLabel && shop.nextMarketLabel.weekday !== 0 ? shop.nextMarketLabel : null;
  if (other) {
    const otherLabel = otherMarketLabel(shop, other);
    return otherLabel ? translate(locale, otherLabel) : null;
  }
  let label: string;
  switch (shop.nextMarketStatus) {
    case "scheduled": label = shop.hasMapLocation === false ? "次の日曜は出店予定（場所を確認中）" : "次の日曜は出店予定"; break;
    case "not_scheduled": label = "次の日曜は出店予定なし"; break;
    case "market_closed": label = "次の日曜市は中止・休み"; break;
    case "unknown": label = "次の日曜の出店予定を確認中"; break;
    default: return null;
  }
  return translate(locale, label);
}

function otherMarketLabel(shop: ShopProfile, market: { name: string; weekday: number }): string | null {
  const name = `${market.name}（毎週${WEEKDAY_JA[market.weekday]}曜）`;
  switch (shop.nextMarketStatus) {
    case "scheduled": return shop.hasMapLocation === false ? `${name}に出店予定（場所を確認中）` : `${name}に出店予定`;
    case "not_scheduled": return `${name}の出店予定なし`;
    case "market_closed": return `${name}は中止・休み`;
    case "unknown": return `${name}の出店予定を確認中`;
    default: return null;
  }
}
