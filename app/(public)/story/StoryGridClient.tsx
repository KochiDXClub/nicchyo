"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import Image from "next/image";
import NavigationBar from "@/app/components/NavigationBar";
import { EmptyState, PageContainer, PageShell } from "@/components/ui";
import StoryViewer from "./StoryViewer";
import { StoryDemoBadge } from "./components/StoryChrome";
import StoryGridSections from "./components/StoryGridSections";
import { getNextSundayLabel } from "@/lib/utils/date";
import { fetchReactionCounts } from "@/lib/story/reactions";
import MarketStatusCalendar from "@/app/components/market/MarketStatusCalendar";
import { PHOTOS } from "@/app/(public)/_landing/content";
import "@/app/(public)/_landing/landing.css";
import UpcomingSundays from "@/app/components/market/UpcomingSundays";
import { useMarketCalendar } from "@/lib/market/useMarketCalendar";
import { groupEventsBySunday, UPCOMING_SUNDAYS_PREVIEW_COUNT } from "@/lib/market/calendar";
import type { StoryItem } from "./types";

/** 出店者の近況を、開催情報・投稿の順に見せる。 */
type Props = {
  demo?: {
    /** 新しい順の見本の投稿 */
    stories: StoryItem[];
    /** 投稿ごとの見本のハート数 */
    heartCounts: Record<string, number>;
  };
};

export default function StoryGridClient({ demo }: Props = {}) {
  const [stories, setStories] = useState<StoryItem[]>(() => demo?.stories ?? []);
  const [loading, setLoading] = useState(!demo);
  const [fetchError, setFetchError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [heartCounts, setHeartCounts] = useState<Record<string, number> | null>(() => demo?.heartCounts ?? null);
  const nextSunday = useMemo(() => getNextSundayLabel(), []);
  const { calendar } = useMarketCalendar();
  const isDemo = demo !== undefined;

  useEffect(() => {
    if (isDemo) return;
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStories(data);
        else setFetchError(true);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [isDemo]);

  // 最初の開き方を一度だけ決める。stories が再フェッチされても勝手に開き直さない。
  //   ?content=<vendor_contents.id> 付き … その投稿を全画面で直接開く
  //                                       （マップのショップバナー「今日のお知らせ」から）
  const initialOpenHandledRef = useRef(false);
  useEffect(() => {
    if (stories.length === 0 || initialOpenHandledRef.current) return;
    initialOpenHandledRef.current = true;
    const contentId = new URLSearchParams(window.location.search).get("content");
    if (contentId) {
      const index = stories.findIndex((story) => story.id === contentId);
      if (index >= 0) {
        setViewerIndex(index);
        return;
      }
    }
  }, [stories]);

  // 一覧のハート数を取得し、ビューアで操作した後は閉じた時に更新する。
  useEffect(() => {
    if (isDemo || stories.length === 0 || viewerIndex !== null) return;
    let cancelled = false;
    fetchReactionCounts(stories.map((story) => story.id))
      .then(({ counts }) => {
        if (!cancelled) setHeartCounts(counts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDemo, stories, viewerIndex]);

  const openViewer = (index: number) => {
    setViewerIndex(index);
  };

  const upcomingSundays = groupEventsBySunday(
    calendar.events,
    calendar.days,
    UPCOMING_SUNDAYS_PREVIEW_COUNT
  );

  return (
    <PageShell as="main" topNav>
      <PageContainer
        width="wide"
        // lg 以上は右上に「マップにもどる」の小さなバーが浮かぶ。幅 64rem の中身の右端と重ならないよう、
        // その下から始める（padding は inline style が先に効くので !important で上書きする）
        className="md:pt-8 lg:!pt-[4.75rem]"
        style={{ paddingTop: "calc(1rem + var(--safe-top, 0px))" }}
      >
        <div className="min-w-0 space-y-7 sm:space-y-9">
          <header className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-6">
              <h1 className="text-3xl font-bold tracking-tight text-nicchyo-ink sm:text-4xl">近況</h1>
              <p className="text-sm leading-relaxed text-nicchyo-ink/70">市のいまを、出店者さんから。</p>
            </div>
            <span aria-hidden="true" className="block h-1 w-12 rounded-full bg-nicchyo-primary" />
          </header>

          {/* 開催中止などの情報は、投稿より先に案内する。 */}
          <section aria-labelledby="story-market-heading" className="space-y-3">
            <h2 id="story-market-heading" className="text-lg font-bold text-nicchyo-ink">開催のご案内</h2>
            <div className="relative isolate flex min-h-[8.2rem] min-w-0 items-center overflow-hidden rounded-card sm:min-h-48">
              {/* A案のように写真を開催情報の背景へ重ね、左側を地色になじませる。 */}
              <div
                aria-hidden="true"
                className="landing-fade-x pointer-events-none absolute inset-y-0 right-0 w-[68%] [mask-repeat:no-repeat] [mask-size:300%_100%] sm:w-[76%]"
              >
                <Image
                  src={PHOTOS.stalls.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 768px, 75vw"
                  className="object-cover"
                />
              </div>
              <MarketStatusCalendar
                day={calendar.day}
                showSummary={false}
                className="relative z-10 min-w-0 max-w-full !gap-2 sm:max-w-[55%] sm:!gap-4 [&>div]:rounded-btn [&>div]:bg-nicchyo-base/95 [&>div]:px-2 [&>div]:py-1"
              />
            </div>
          </section>

            {isDemo && (
              <p className="flex items-start gap-2 rounded-card bg-white px-4 py-3 text-xs leading-relaxed text-nicchyo-ink/70 ring-1 ring-line">
                <StoryDemoBadge />
                <span>近況のデモです。お店・投稿・AIキャラのひとことは、すべて見本です。</span>
              </p>
            )}

            {loading ? (
              <div className="space-y-6" aria-busy>
                <div className="grid grid-cols-1 gap-3 overflow-hidden rounded-card sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="aspect-[4/3] animate-pulse rounded-card bg-nicchyo-ink/5" />
                  ))}
                </div>
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm text-nicchyo-ink/55">投稿の読み込みに失敗しました</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 text-xs font-semibold text-nicchyo-ink/70 underline underline-offset-2"
                >
                  再読み込み
                </button>
              </div>
            ) : stories.length === 0 ? (
              <EmptyState
                icon={Camera}
                title="まだ投稿がありません"
                description={`次の日曜市は ${nextSunday}`}
              />
            ) : (
              <StoryGridSections stories={stories} heartCounts={heartCounts} onOpen={openViewer} />
            )}

            <div className="border-t border-line-warm pt-6">
              <UpcomingSundays sundays={upcomingSundays} showMoreLink />
            </div>
        </div>
      </PageContainer>

      {/* 全画面ビューアー */}
      <AnimatePresence>
        {viewerIndex !== null && (
          <StoryViewer
            stories={stories}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
            demo={demo}
          />
        )}
      </AnimatePresence>

      <NavigationBar backBarOnTop />
    </PageShell>
  );
}
