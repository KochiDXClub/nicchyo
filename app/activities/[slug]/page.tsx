import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ACTIVITIES, getActivityBySlug } from "../../data/activities";

type ActivityDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return ACTIVITIES.map((activity) => ({
    slug: activity.slug,
  }));
}

export async function generateMetadata({
  params,
}: ActivityDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const activity = getActivityBySlug(slug);
  if (!activity) {
    return {
      title: "取り組み | nicchyo",
    };
  }

  return {
    title: `${activity.title} | nicchyo`,
    description: activity.summary,
  };
}

export default async function ActivityDetailPage({ params }: ActivityDetailPageProps) {
  const { slug } = await params;
  const activity = getActivityBySlug(slug);

  if (!activity) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f1e8] px-4 py-10 text-stone-900 sm:px-6 md:px-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/activities"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8a5129] transition hover:text-[#6f3a16]"
        >
          <ChevronLeft className="h-4 w-4" />
          取り組み一覧へ戻る
        </Link>

        <article className="mt-6 rounded-[2rem] border border-[#ead8c0] bg-white px-5 py-6 shadow-[0_18px_48px_rgba(102,58,20,0.08)] md:px-7 md:py-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-[0.12em] text-[#9a5a2e]">
              {activity.date}
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              {activity.category}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold leading-tight text-[#40230e] md:text-5xl">
            {activity.title}
          </h1>

          {activity.image ? (
            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#ead8c0] bg-[#fffaf4]">
              <Image
                src={activity.image}
                alt={activity.title}
                width={1200}
                height={800}
                sizes="(max-width: 768px) 100vw, 768px"
                className="h-auto w-full object-cover"
              />
            </div>
          ) : null}

          {activity.note ? (
            <p className="mt-3 text-sm font-medium text-stone-500">{activity.note}</p>
          ) : null}

          <p className="mt-4 text-lg leading-8 text-stone-700">{activity.summary}</p>

          <div className="mt-8 space-y-6">
            {activity.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-bold text-[#4c2810]">{section.heading}</h2>
                <p className="mt-2 text-base leading-8 text-stone-700">{section.body}</p>
              </section>
            ))}
          </div>

          {activity.externalLink ? (
            <div className="mt-8 rounded-[1.5rem] border border-[#ead8c0] bg-[#fffaf4] px-4 py-4">
              <a
                href={activity.externalLink.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 text-sm font-semibold text-[#8a5129] transition hover:text-[#6f3a16]"
              >
                {activity.externalLink.image ? (
                  <Image
                    src={activity.externalLink.image}
                    alt=""
                    width={120}
                    height={32}
                    unoptimized
                    className="h-8 w-auto object-contain"
                  />
                ) : null}
                {activity.externalLink.label}
              </a>
            </div>
          ) : null}
        </article>
      </div>
    </main>
  );
}
