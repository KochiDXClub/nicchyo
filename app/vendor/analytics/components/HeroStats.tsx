import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { Surface, buttonClass } from "@/components/ui";
import { describeChange } from "@/lib/vendor/analyticsSummary";
import type { HeartSummary, ShopViewSummary } from "../../_types";

/**
 * 一番上。この1週間の反応を、「お店が見られた回数」を主役に3つだけ出す。
 * 数が取れなかった（null）ものは、0 と見間違えないよう「—」にする。
 */
export default function HeroStats({
  views,
  recommendationCount,
  hearts,
}: {
  views: ShopViewSummary | null;
  recommendationCount: number | null;
  hearts: HeartSummary | null;
}) {
  const noViewsYet = views !== null && views.thisWeek === 0 && views.lastWeek === 0;

  return (
    <Surface elevation="lifted" padding="lg">
      <p className="text-sm font-bold text-nicchyo-ink/70">この1週間、お店が見られた回数</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-6xl tabular-nums leading-none text-nicchyo-ink">
          {views ? views.thisWeek.toLocaleString("ja-JP") : "—"}
        </span>
        <span className="text-lg font-bold text-nicchyo-ink/70">回</span>
      </p>
      {views && <p className="mt-2 text-sm text-nicchyo-ink/70">{describeChange(views.thisWeek, views.lastWeek)}</p>}
      <p className="mt-1 text-xs leading-relaxed text-nicchyo-ink/55">
        お客さんが同じタブでお店を開き直した分は、1回と数えます。自分で開いた分は数えません。
      </p>

      <dl className="mt-5 grid grid-cols-2 divide-x divide-line border-t border-line pt-4">
        <div className="pr-4">
          <dt className="flex items-center gap-1.5 text-xs font-bold text-nicchyo-ink/70">
            <Sparkles size={14} aria-hidden="true" />
            にちよさんのおすすめ
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-nicchyo-ink">
            {recommendationCount === null ? "—" : `${recommendationCount.toLocaleString("ja-JP")}回`}
          </dd>
        </div>
        <div className="pl-4">
          <dt className="flex items-center gap-1.5 text-xs font-bold text-nicchyo-ink/70">
            <Heart size={14} aria-hidden="true" />
            もらったハート
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums text-nicchyo-ink">
            {hearts === null ? "—" : `${hearts.thisWeek.toLocaleString("ja-JP")}個`}
          </dd>
        </div>
      </dl>

      {noViewsYet && (
        <div className="mt-5 rounded-btn bg-amber-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-900">
            まだ数字がないき、日曜市のあとにまた見に来てや。写真や近況を整えておくと、見られやすうなるよ。
          </p>
          <Link href="/vendor/posts" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-3" })}>
            近況を出す
          </Link>
        </div>
      )}
    </Surface>
  );
}
