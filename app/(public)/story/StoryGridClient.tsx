"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Camera, Play } from "lucide-react";
import NavigationBar from "@/app/components/NavigationBar";
import { EmptyState, PageContainer, PageShell } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import StoryViewer from "./StoryViewer";
import StoryCover from "./components/StoryCover";
import StoryPeekSheet from "./components/StoryPeekSheet";
import StoryVendorTray from "./components/StoryVendorTray";
import StoryGridSections from "./components/StoryGridSections";
import { getNextSundayLabel } from "@/lib/utils/date";
import { getStoryAgeBucket } from "./age";
import { fetchReactionCounts } from "@/lib/story/reactions";
import MarketStatusBar from "@/app/components/market/MarketStatusBar";
import UpcomingSundays from "@/app/components/market/UpcomingSundays";
import { useMarketCalendar } from "@/lib/market/useMarketCalendar";
import { groupEventsBySunday, UPCOMING_SUNDAYS_PREVIEW_COUNT } from "@/lib/market/calendar";
import type { StoryItem } from "./types";

const DESKTOP_QUERY = "(min-width: 768px)";
/** 全画面ビューアのフェードイン（0.18s）が終わるまで、引き上げたシートを下に残す時間 */
const PEEK_HANDOFF_MS = 250;

/**
 * 近況（出店者のストーリー）のページ。
 *
 * スマホ … 開くと最新の投稿が「開いたストーリー」の形で下から半分出る（StoryPeekSheet）。
 *          上へ引けばそのまま再生、下へ払えば店の列と一覧が触れる。
 * PC     … 左に最新の投稿の表紙（押すと再生）、右に店の列と一覧を並べる。
 */
export default function StoryGridClient() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const [heartCounts, setHeartCounts] = useState<Record<string, number>>({});
  const nextSunday = useMemo(() => getNextSundayLabel(), []);
  const { calendar } = useMarketCalendar();

  useEffect(() => {
    fetch("/api/stories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStories(data);
        else setFetchError(true);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  // 最初の開き方を一度だけ決める。stories が再フェッチされても勝手に開き直さない。
  //   ?content=<vendor_contents.id> 付き … その投稿を全画面で直接開く
  //                                       （マップのショップバナー「今日のお知らせ」から）
  //   スマホ                               … 最新の投稿を半開きのシートで出す
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
    if (!window.matchMedia(DESKTOP_QUERY).matches) setPeekOpen(true);
  }, [stories]);

  // サムネイル用のハート数をバッチ取得（失敗しても一覧の表示には影響させない）
  useEffect(() => {
    if (stories.length === 0) return;
    let cancelled = false;
    fetchReactionCounts(stories.map((story) => story.id))
      .then(({ counts }) => {
        if (!cancelled) setHeartCounts(counts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stories]);

  const openViewer = (index: number) => {
    setPeekOpen(false);
    setViewerIndex(index);
  };

  // シートを引き上げ切ったら、その上に全画面ビューアを重ねる。ビューアがフェードインし
  // 終わるまでシートを残しておかないと、あいだに一覧が一瞬透けて見える
  const peekHandoffTimerRef = useRef<number | null>(null);
  const launchFromPeek = () => {
    setViewerIndex(0);
    peekHandoffTimerRef.current = window.setTimeout(() => {
      peekHandoffTimerRef.current = null;
      setPeekOpen(false);
    }, PEEK_HANDOFF_MS);
  };
  useEffect(
    () => () => {
      if (peekHandoffTimerRef.current !== null) window.clearTimeout(peekHandoffTimerRef.current);
    },
    []
  );

  const hasThisWeek = stories.some((story) => getStoryAgeBucket(story.created_at) === "this_week");
  // 「これからの日曜市」は通常は出店者の投稿より下に置く（近況を運営の予定が占拠しないため）。
  // ただし今週の出店者投稿が0件のときだけ、上に出して空いた画面を埋める。
  const hoistCalendar = !loading && !fetchError && !hasThisWeek;
  const upcomingSundays = groupEventsBySunday(
    calendar.events,
    calendar.days,
    UPCOMING_SUNDAYS_PREVIEW_COUNT
  );
  const latest = stories[0] ?? null;
  // PC で左に表紙を置く段組み。読み込み中は表紙の場所を空けておき、中身がずれないようにする
  const withCover = !fetchError && (loading || latest !== null);

  return (
    <PageShell as="main">
      <PageContainer
        width="wide"
        className="md:pt-8"
        style={{ paddingTop: "calc(1rem + var(--safe-top, 0px))" }}
      >
        <div
          className={cn(
            withCover &&
              "md:grid md:grid-cols-[18rem_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[21rem_minmax(0,1fr)] lg:gap-10"
          )}
        >
          {withCover && (
            <aside className="hidden md:sticky md:top-8 md:block">
              {latest ? (
                <button
                  type="button"
                  onClick={() => openViewer(0)}
                  className="group relative block aspect-[9/16] w-full overflow-hidden rounded-card shadow-lift"
                  aria-label={`${latest.vendor?.shop_name ?? "出店者"}の近況を再生`}
                >
                  <StoryCover story={latest} count={stories.length} priority />
                  <span className="absolute inset-0 z-20 flex items-center justify-center bg-black/0 transition group-hover:bg-black/15">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-nicchyo-ink shadow-pop transition group-hover:scale-105">
                      <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
                    </span>
                  </span>
                </button>
              ) : (
                <div className="aspect-[9/16] w-full animate-pulse rounded-card bg-nicchyo-ink/5" />
              )}
            </aside>
          )}

          <div className="min-w-0 space-y-6">
            {/* 開催ステータス：中止の連絡が下にあっては意味がないので最上部に置く */}
            <MarketStatusBar day={calendar.day} placement="page" />

            {hoistCalendar && <UpcomingSundays sundays={upcomingSundays} showMoreLink />}

            {loading ? (
              <div className="space-y-6" aria-busy>
                <div className="flex gap-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-[3.75rem] w-[3.75rem] shrink-0 animate-pulse rounded-full bg-nicchyo-ink/5" />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-card md:grid-cols-4 md:gap-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="aspect-[3/4] animate-pulse bg-nicchyo-ink/5 md:rounded-btn" />
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
              <>
                <StoryVendorTray stories={stories} onOpen={openViewer} />
                <StoryGridSections stories={stories} heartCounts={heartCounts} onOpen={openViewer} />
              </>
            )}

            {!hoistCalendar && (
              <div className="border-t border-line-warm pt-6">
                <UpcomingSundays sundays={upcomingSundays} showMoreLink />
              </div>
            )}
          </div>
        </div>
      </PageContainer>

      {peekOpen && latest && (
        <StoryPeekSheet
          story={latest}
          count={stories.length}
          onLaunch={launchFromPeek}
          onDismiss={() => setPeekOpen(false)}
        />
      )}

      {/* 全画面ビューアー */}
      <AnimatePresence>
        {viewerIndex !== null && (
          <StoryViewer
            stories={stories}
            initialIndex={viewerIndex}
            onClose={() => setViewerIndex(null)}
          />
        )}
      </AnimatePresence>

      <NavigationBar />
    </PageShell>
  );
}
