import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { getActivitiesSortedDesc } from "../data/activities";

export const metadata: Metadata = {
  title: "取り組み | nicchyo",
  description: "nicchyoの活動記録、行政連携、現地調査、受賞、発表の一覧です。",
};

const categoryStyles = {
  行政連携: "bg-[#efe1ce] text-[#7b4721]",
  現地調査: "bg-[#f7e8d7] text-[#8b4d20]",
  発表: "bg-[#f1e5d4] text-[#754420]",
  受賞: "bg-[#f6ead7] text-[#7d4b1f]",
} as const;

export default function ActivitiesPage() {
  const activities = getActivitiesSortedDesc();
  const latestActivity = activities[0] ?? null;
  const archiveActivities = activities.slice(1);

  return (
    <main className="min-h-screen bg-[#f7f1e8] px-4 py-10 text-stone-900 sm:px-6 md:px-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8a5129] transition hover:text-[#6f3a16]"
        >
          <ChevronLeft className="h-4 w-4" />
          トップへ戻る
        </Link>

        <div className="mt-6 space-y-4">
          <h1 className="text-4xl font-bold leading-tight text-[#40230e] md:text-6xl">
            プロジェクトの歩み
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-stone-700 md:text-xl">
            行政との対話、現地での調査、発表や受賞まで。
            <br />
            nicchyoが積み重ねてきた取り組みをまとめています。
          </p>
        </div>

        {latestActivity ? (
          <section className="mt-10">
            <p className="text-sm font-semibold tracking-[0.14em] text-[#9a5a2e]">最新の取り組み</p>
            <Link
              href={`/activities/${latestActivity.slug}`}
              className="group mt-4 block overflow-hidden rounded-[2rem] border border-[#ead8c0] bg-white shadow-[0_18px_48px_rgba(102,58,20,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(102,58,20,0.12)]"
            >
              {latestActivity.image ? (
                <div className="relative aspect-[16/8] overflow-hidden bg-[#eadcc9]">
                  <Image
                    src={latestActivity.image}
                    alt={latestActivity.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ) : null}
              <div className="space-y-4 px-6 py-6 md:px-8 md:py-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#5b3015] px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-white">
                    最新
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${categoryStyles[latestActivity.category]}`}
                  >
                    {latestActivity.category}
                  </span>
                  <span className="text-xs font-semibold tracking-[0.12em] text-[#9a5a2e]">
                    {latestActivity.date}
                  </span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold leading-tight text-[#4c2810] md:text-3xl">
                    {latestActivity.title}
                  </h2>
                  <p className="max-w-3xl text-base leading-8 text-stone-700 md:text-lg">
                    {latestActivity.summary}
                  </p>
                  {latestActivity.note ? (
                    <p className="text-sm font-medium text-stone-500">{latestActivity.note}</p>
                  ) : null}
                </div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#8a5129]">
                  詳しく見る
                  <ArrowUpRight className="h-4 w-4 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          </section>
        ) : null}

        <section className="mt-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#5b3015] shadow-sm">
              全{activities.length}件
            </span>
            <span className="rounded-full bg-[#efe1ce] px-3 py-1.5 text-sm font-semibold text-[#7b4721]">
              行政連携・現地調査・発表・受賞
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {archiveActivities.map((activity) => (
              <article key={`${activity.date}-${activity.title}`}>
                <Link
                  href={`/activities/${activity.slug}`}
                  className="group flex flex-col gap-4 rounded-[1.75rem] border border-[#ead8c0] bg-white p-5 shadow-[0_18px_48px_rgba(102,58,20,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(102,58,20,0.1)] sm:flex-row sm:items-center sm:p-6"
                >
                  {activity.image ? (
                    <div className="relative h-32 w-full overflow-hidden rounded-[1.5rem] bg-[#eadcc9] sm:h-28 sm:w-40 sm:shrink-0">
                      <Image
                        src={activity.image}
                        alt={activity.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 160px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center rounded-[1.5rem] bg-[#f1e1cf] text-sm font-bold tracking-[0.14em] text-[#8a5129] sm:h-28 sm:w-40 sm:shrink-0">
                      {activity.category}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[activity.category]}`}
                      >
                        {activity.category}
                      </span>
                      <span className="text-xs font-semibold tracking-[0.12em] text-[#9a5a2e]">
                        {activity.date}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold leading-tight text-[#4c2810]">
                      {activity.title}
                    </h2>
                    <p className="text-sm leading-7 text-stone-700 sm:text-base">
                      {activity.summary}
                    </p>
                    {activity.note ? (
                      <p className="text-sm font-medium text-stone-500">{activity.note}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center text-sm font-semibold text-[#8a5129] sm:self-stretch">
                    詳しく見る
                    <ArrowUpRight className="ml-2 h-4 w-4 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
