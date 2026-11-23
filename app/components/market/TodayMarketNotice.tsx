import Link from "next/link";
import { WEEKDAY_JA, hasMultiplePublicMarkets, pickTodayMarket } from "@/lib/market/marketPick";
import type { PublicMarket } from "@/lib/market/publicMarkets.server";

type Props = {
  markets: PublicMarket[];
  now?: Date;
};

/**
 * 近況の先頭に出す「今日の市」。今日開催の公開中の市があるときだけ、市が2つ以上公開されているとき限定で出す。
 * 日曜市だけの間は何も出さない（表示が変わらない）。
 */
export default function TodayMarketNotice({ markets, now }: Props) {
  if (!hasMultiplePublicMarkets(markets)) return null;
  const today = pickTodayMarket(markets, now);
  if (!today) return null;

  return (
    <p className="mx-auto max-w-[64rem] px-4 pt-3 text-sm text-nicchyo-ink/80">
      今日は<Link href={`/map?market=${encodeURIComponent(today.slug)}`} className="font-bold underline underline-offset-2">{today.name}</Link>
      （毎週{WEEKDAY_JA[today.weekday]}曜日）の日です。
    </p>
  );
}
