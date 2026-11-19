import Link from "next/link";
import { Surface, buttonClass } from "@/components/ui";
import { WEEKDAY_JA, hasMultiplePublicMarkets } from "@/lib/market/marketPick";
import type { PublicMarket } from "@/lib/market/publicMarkets.server";

type Props = {
  markets: PublicMarket[];
};

/**
 * トップの「市を選ぶ」。選んだ市の地図へ進む（地図が市ごとに始まる作業は #1108）。
 * 公開中の市が1つだけ（日曜市だけ）のときは何も出さない。
 */
export default function PublicMarketChoice({ markets }: Props) {
  if (!hasMultiplePublicMarkets(markets)) return null;

  return (
    <section aria-labelledby="public-market-choice" className="mx-auto max-w-[64rem] px-5 py-8 md:px-10">
      <h2 id="public-market-choice" className="text-lg font-bold text-nicchyo-ink">
        市を選ぶ
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {markets.map((market) => (
          <li key={market.id}>
            <Surface as="div" padding="sm" className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold text-nicchyo-ink">{market.name}</p>
                <p className="text-xs text-nicchyo-ink/60">毎週{WEEKDAY_JA[market.weekday]}曜日</p>
              </div>
              <Link href={`/map?market=${encodeURIComponent(market.slug)}`} className={buttonClass({ size: "sm" })}>
                地図で見る
              </Link>
            </Surface>
          </li>
        ))}
      </ul>
    </section>
  );
}
