import Link from "next/link";
import type { ShopProfile } from "../types/shopData";
import { nextMarketStatusLabel } from "@/lib/shops/marketStatus";
import { useLocale } from "@/lib/i18n/LocaleContext";

/** 地図にピンがない店舗へ、店舗ページからアクセスできるようにする。 */
export function UnplacedSearchResults({ shops }: { shops: ShopProfile[] }) {
  const locale = useLocale();
  if (shops.length === 0) return null;
  return <div className="max-h-48 overflow-y-auto rounded-btn bg-white p-3 shadow-card ring-1 ring-line" aria-label="地図に表示されていない検索結果">
    <p className="text-xs font-bold text-nicchyo-ink/70">地図に表示されていない店舗</p>
    <ul className="mt-1 divide-y divide-line">{shops.map((shop) => <li key={shop.id}>
      <Link href={`/shops/${shop.id}`} className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm"><span><span className="font-bold">{shop.name}</span><span className="ml-2 text-xs text-nicchyo-ink/70">{nextMarketStatusLabel(shop, locale)}</span></span><span aria-hidden="true" className="text-lg text-nicchyo-ink/55">›</span></Link>
    </li>)}</ul>
  </div>;
}
