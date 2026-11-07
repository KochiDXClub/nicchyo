import type { ShopProfile } from "@/app/(public)/map/types/shopData";
import { translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";

/** 指定日の出店状況。未設定・競合を休みと断定しない。 */
export function nextMarketStatusLabel(shop: ShopProfile, locale: Locale = "ja"): string | null {
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
