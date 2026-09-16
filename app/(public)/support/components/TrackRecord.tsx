import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ACTIVITY_CATEGORY_STYLES, getActivitiesSortedDesc } from "@/app/data/activities";

/**
 * これまでの歩み
 *
 * 以前は運営ページ側に受賞と連携を手書きで2行持っていたが、同じ内容が
 * app/data/activities.ts に記事として揃っている。二重管理をやめて、そちらから出す。
 * 各行から /activities/[slug] へ飛べるので、読む側が裏を取れる。
 *
 * 要約はここには出さない。判断に要るのは「いつ・何を・どの種類か」までで、
 * 中身は記事側にある。
 */

/** "2026年3月17日" → "2026.03"。読めない形なら空文字 */
function toYearMonth(japaneseDate: string): string {
  const match = japaneseDate.match(/(\d{4})年(\d{1,2})月/);
  if (!match) return "";
  const [, year, month] = match;
  return `${year}.${month.padStart(2, "0")}`;
}

export default function TrackRecord() {
  const activities = getActivitiesSortedDesc();

  return (
    <div>
      <ol className="border-t border-nicchyo-ink/10">
        {activities.map((activity) => (
          <li key={activity.slug}>
            <Link
              href={`/activities/${activity.slug}`}
              className="group flex items-baseline gap-4 border-b border-nicchyo-ink/[0.07] py-3.5 transition-colors hover:bg-nicchyo-ink/[0.02]"
            >
              <span className="w-[3.6rem] shrink-0 text-[11.5px] tabular-nums text-nicchyo-ink/40">
                {toYearMonth(activity.date)}
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${ACTIVITY_CATEGORY_STYLES[activity.category]}`}
              >
                {activity.category}
              </span>
              <span className="min-w-0 flex-1 text-[14px] font-bold leading-relaxed decoration-nicchyo-ink/25 underline-offset-4 group-hover:underline">
                {activity.title}
              </span>
              <ArrowUpRight
                className="mt-1 h-3.5 w-3.5 shrink-0 text-nicchyo-ink/20 transition group-hover:text-nicchyo-ink/50"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ol>

      <Link
        href="/activities"
        className="mt-5 inline-block text-[13px] font-bold text-nicchyo-ink/45 underline-offset-4 transition hover:text-nicchyo-ink/75 hover:underline"
      >
        取り組みの記録をすべて見る
      </Link>
    </div>
  );
}
