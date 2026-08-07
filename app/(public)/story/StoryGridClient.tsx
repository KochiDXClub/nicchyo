"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import NavigationBar from "@/app/components/NavigationBar";
import StoryViewer from "./StoryViewer";
import LoadingLantern, { LOADING_LANTERN_DURATION_MS } from "./components/LoadingLantern";
import { getNextSundayLabel } from "@/lib/utils/date";
import {
  getStoryAgeBucket,
  STORY_AGE_IMAGE_CLASS,
  STORY_AGE_LABEL,
  STORY_AGE_ORDER,
} from "./age";
import { fetchReactionCounts } from "@/lib/story/reactions";
import MarketStatusBar from "@/app/components/market/MarketStatusBar";
import UpcomingSundays from "@/app/components/market/UpcomingSundays";
import { useMarketCalendar } from "@/lib/market/useMarketCalendar";
import { groupEventsBySunday, UPCOMING_SUNDAYS_PREVIEW_COUNT } from "@/lib/market/calendar";
import type { StoryItem } from "./types";

// グリッド上部の目立つプレビュー枠で1件あたり表示する時間。
// 全画面ビューア（15秒）よりテンポよく見せるための「ちら見せ」なので短めにする。
const FEATURED_PREVIEW_DURATION = 4000;

export default function StoryGridClient() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [heartCounts, setHeartCounts] = useState<Record<string, number>>({});
  const nextSunday = useMemo(() => getNextSundayLabel(), []);
  const { calendar } = useMarketCalendar();

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), LOADING_LANTERN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

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

  // ?content=<vendor_contents.id> が付いていたら該当ストーリーを直接開く
  // （マップのショップバナー「今日のお知らせ」からの遷移用）。
  // stories が再フェッチされてもビューアが勝手に再オープンしないよう、
  // 一度処理したら二度と実行しない
  const contentNavHandledRef = useRef(false);
  useEffect(() => {
    if (stories.length === 0 || contentNavHandledRef.current) return;
    const contentId = new URLSearchParams(window.location.search).get("content");
    if (!contentId) return;
    contentNavHandledRef.current = true;
    const index = stories.findIndex((story) => story.id === contentId);
    if (index >= 0) setViewerIndex(index);
  }, [stories]);

  // サムネイル用のハート数をバッチ取得（失敗してもグリッド表示には影響させない）
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

  // 上部の目立つプレビュー枠（FeaturedStoryPreview）は「今週」の投稿だけを対象にする
  // （日曜市は週次開催のため、鮮度の単位も週で区切るのが自然）。
  // stories は新しい順に並んでいるため、今週の投稿は必ず先頭からの連続区間になる。
  // その分は通常グリッドから除外し、重複表示を避ける。
  const previewCount = useMemo(
    () => stories.filter((story) => getStoryAgeBucket(story.created_at) === "this_week").length,
    [stories]
  );

  // 鮮度バケット（今週/1週間前/1か月前）ごとにまとめる。index は元の
  // stories 配列（新しい順）の位置なので、ビューアの initialIndex と整合する。
  const sections = useMemo(
    () =>
      STORY_AGE_ORDER.map((bucket) => ({
        bucket,
        items: stories
          .map((story, index) => ({ story, index }))
          .filter(({ story, index }) => index >= previewCount && getStoryAgeBucket(story.created_at) === bucket),
      })).filter((section) => section.items.length > 0),
    [stories, previewCount]
  );

  // 「これからの日曜市」は通常は出店者の投稿より下に置く（近況フィードを運営が占拠しないため）。
  // ただし今週の出店者投稿が0件のときだけ、スカスカの画面を運営の予定で埋める。
  const hoistCalendar = !loading && !fetchError && previewCount === 0;
  const upcomingSundays = groupEventsBySunday(
    calendar.events,
    calendar.days,
    UPCOMING_SUNDAYS_PREVIEW_COUNT
  );

  // API が提灯ローディング中に失敗した場合は、待たずにエラー表示へ進む
  if (pageLoading && !fetchError) return <LoadingLantern />;

  return (
    <main className="relative min-h-screen bg-nicchyo-base pb-28">
      {/* ページ全体にうっすら繋がる粒感。ヘッダーの霧より弱く・無色のまま敷き、
          グリッド部分の隙間（背景色が見える箇所）にだけ質感として滲ませる。 */}
      <div
        aria-hidden
        className="story-fog-grain pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-overlay"
      />
      {/* 開催ステータス：中止の連絡が下にあっては意味がないので最上部に固定する */}
      <div className="relative z-10 mx-auto max-w-lg px-4 pt-4">
        <MarketStatusBar day={calendar.day} placement="page" />
      </div>

      {/* 見出し：ページ最上部のヒーロー的なタイトル（ナビゲーションではない） */}
      <div className="relative overflow-hidden px-4 pt-6 pb-7">
        {/* 背景の柔らかい光彩でタイトルに奥行きを出す。霧のようにゆっくり揺らめかせ、
            濃淡（不透明度）も個々にずらしながら周期的に変化させることで、
            常にどれかが濃く／薄く見える自然な呼吸感を出す。
            緑エリアには青、オレンジエリアには赤みのピンクの霧を重ねて漂わせ、
            重なった部分だけ色が混ざり合って見えるようにしている。 */}
        <motion.div
          aria-hidden
          animate={{
            x: [0, 110, -70, 0],
            y: [0, 30, -18, 0],
            scale: [1, 1.15, 0.94, 1],
            opacity: [0.85, 0.35, 0.85],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full bg-nicchyo-primary/30 blur-3xl"
        />
        {/* 緑の霧に混ざり合う青の霧。green の動きとは位相・周期をずらし、
            重なりが常に一定にならず滲むように交差させる。 */}
        <motion.div
          aria-hidden
          animate={{
            x: [0, -80, 90, 0],
            y: [0, 24, -28, 0],
            scale: [1, 0.92, 1.2, 1],
            opacity: [0.3, 0.65, 0.3],
          }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          className="pointer-events-none absolute -left-6 -top-8 h-52 w-52 rounded-full bg-sky-400/40 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{
            x: [0, -95, 60, 0],
            y: [0, 26, -16, 0],
            scale: [1, 0.9, 1.12, 1],
            opacity: [0.3, 0.85, 0.3],
          }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
          className="pointer-events-none absolute -top-10 right-0 h-44 w-44 rounded-full bg-nicchyo-accent/30 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{
            x: [0, -85, 100, 0],
            y: [0, -20, 16, 0],
            scale: [1, 1.1, 0.92, 1],
            opacity: [0.2, 0.75, 0.2],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
          className="pointer-events-none absolute -bottom-12 left-1/3 h-52 w-52 rounded-full bg-orange-300/35 blur-3xl"
        />
        {/* オレンジの霧に混ざり合う、赤みのピンクの霧。orange の動きと位相・周期を
            ずらして交差させ、混ざる濃さが揺れながら変化するようにする。 */}
        <motion.div
          aria-hidden
          animate={{
            x: [0, 90, -105, 0],
            y: [0, -22, 20, 0],
            scale: [1, 1.14, 0.9, 1],
            opacity: [0.25, 0.65, 0.25],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3.4 }}
          className="pointer-events-none absolute -bottom-10 left-1/4 h-48 w-48 rounded-full bg-rose-400/40 blur-3xl"
        />
        {/* 粒感テクスチャ：フラクタルノイズ（グレースケール・overlay合成）をゆっくり
            ドリフトさせ、なめらかなブロブだけでは出せない「霧の粒立ち」を足す。 */}
        <div
          aria-hidden
          className="story-fog-grain pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay"
        />
        <div className="relative mx-auto max-w-lg">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-nicchyo-primary">
            Nicchyo Now
          </p>
          <h1 className="mt-1 text-[2.5rem] font-black leading-none tracking-tight text-nicchyo-ink">
            近況
          </h1>
          <p className="mt-2.5 text-sm text-gray-500">出店者のいまが届く、鮮度順のスナップ集</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-nicchyo-primary" />
            <span>新しい投稿ほど鮮やか</span>
            <span className="inline-flex h-1 w-1 rounded-full bg-gray-300" />
            <span>古いほど色あせる</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5">
        {hoistCalendar && (
          <div className="mb-6">
            <UpcomingSundays sundays={upcomingSundays} showMoreLink />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-sm animate-pulse" />
            ))}
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-gray-400">投稿の読み込みに失敗しました</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-nicchyo-primary underline underline-offset-2"
            >
              再読み込み
            </button>
          </div>
        ) : stories.length === 0 ? (
          <EmptyState nextSunday={nextSunday} />
        ) : (
          <>
            {/* 今週の投稿は大きなカードで自動送り表示し、全画面ストーリーへの導線を強める */}
            {previewCount > 0 && (
              <div className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-bold text-nicchyo-ink">今週の投稿</h2>
                  <span className="text-[11px] text-gray-400">{previewCount}件</span>
                </div>
                <FeaturedStoryPreview
                  stories={stories.slice(0, previewCount)}
                  onOpen={(index) => setViewerIndex(index)}
                />
              </div>
            )}

            {/* 鮮度別セクション（新しいほど鮮やか、古いほど退色） */}
            {sections.map((section) => (
              <section key={section.bucket} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-sm font-bold text-nicchyo-ink">
                    {STORY_AGE_LABEL[section.bucket]}
                  </h2>
                  <span className="text-[11px] text-gray-400">{section.items.length}件</span>
                </div>
                <div className="grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden">
                  {section.items.map(({ story, index }) => (
                    <motion.button
                      key={story.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setViewerIndex(index)}
                      className="relative aspect-square bg-gray-100 overflow-hidden focus:outline-none"
                    >
                      <Image
                        src={story.image_url}
                        alt={story.vendor?.shop_name ?? "投稿"}
                        fill
                        className={`object-cover ${STORY_AGE_IMAGE_CLASS[section.bucket]}`}
                        sizes="(max-width: 512px) 33vw, 170px"
                      />
                      {/* 下部オーバーレイ：ショップ名 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1.5">
                        <p className="text-white text-[10px] font-semibold truncate leading-tight">
                          {story.vendor?.shop_name ?? "出店者"}
                        </p>
                      </div>
                      {/* ハート数バッジ（0件のときは出さない） */}
                      {(heartCounts[story.id] ?? 0) > 0 && (
                        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
                          <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="text-rose-400"
                            aria-hidden
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          <span className="text-[9px] font-bold text-white tabular-nums">
                            {heartCounts[story.id]}
                          </span>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </section>
            ))}

            {/* フッター情報 */}
            <p className="mt-4 text-center text-xs text-gray-400">
              {stories.length}件 · 新しいものほど鮮やかに表示
            </p>
          </>
        )}

        {/* これからの日曜市：出店者の投稿の下に独立したセクションとして置く */}
        {!hoistCalendar && (
          <div className="mt-8 border-t border-black/5 pt-6">
            <UpcomingSundays sundays={upcomingSundays} showMoreLink />
          </div>
        )}
      </div>

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
    </main>
  );
}

// 今週の投稿を大きなカードで自動送りし、タップでその場面から全画面ストーリーを
// 開かせるための導線。全画面ビューアと同じ「経過時間バー」を持たせることで、
// 一覧に来ただけで自然と次の投稿へ意識が向くようにする。
function FeaturedStoryPreview({
  stories,
  onOpen,
}: {
  stories: StoryItem[]; // 今週の投稿（新しい順）。index はそのまま全体の index と一致する
  onOpen: (index: number) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState(0);

  // 対象の投稿が入れ替わったら先頭からやり直す
  useEffect(() => {
    setPreviewIndex(0);
  }, [stories]);

  // 一定時間ごとに次の投稿へ（最後まで行ったら先頭へループ）
  useEffect(() => {
    if (stories.length <= 1) return;
    const timer = setTimeout(() => {
      setPreviewIndex((i) => (i + 1) % stories.length);
    }, FEATURED_PREVIEW_DURATION);
    return () => clearTimeout(timer);
  }, [previewIndex, stories.length]);

  const story = stories[previewIndex];
  const shopName = story.vendor?.shop_name ?? "出店者";

  return (
    <button
      type="button"
      onClick={() => onOpen(previewIndex)}
      className="relative block w-full overflow-hidden rounded-2xl text-left focus:outline-none"
      aria-label={`${shopName}の近況を全画面で見る`}
    >
      {/* 明るい画像でもバーが埋もれないよう、上端だけ薄暗くしてから重ねる */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/45 to-transparent" />
      {/* 経過時間バー（全画面ビューアと同じ挙動でこのカードの中だけ自動送りする） */}
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 p-3">
        {stories.map((_, i) => (
          <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40">
            {i < previewIndex ? (
              <div className="h-full w-full rounded-full bg-white" />
            ) : i === previewIndex ? (
              <div
                className="h-full rounded-full bg-white"
                style={{ animation: `story-progress ${FEATURED_PREVIEW_DURATION}ms linear forwards` }}
              />
            ) : (
              <div className="h-full w-0" />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={story.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="relative aspect-[4/3] w-full bg-gray-100"
        >
          <Image
            src={story.image_url}
            alt={shopName}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <span className="inline-flex items-center rounded-full bg-nicchyo-accent px-2 py-0.5 text-[10px] font-bold text-nicchyo-ink">
            最新
          </span>
          <p className="mt-1.5 truncate text-base font-bold text-white">{shopName}</p>
          {story.body && (
            <p className="truncate text-xs text-white/80">{story.body}</p>
          )}
        </div>
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-nicchyo-ink shadow">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function EmptyState({ nextSunday }: { nextSunday: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* イラスト的なアイコン */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-nicchyo-soft-green/30 flex items-center justify-center">
          <svg
            className="w-9 h-9 text-nicchyo-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
        </div>
        {/* デコ */}
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-nicchyo-accent flex items-center justify-center">
          <svg className="w-3 h-3 text-nicchyo-ink" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      <h2 className="text-base font-bold text-nicchyo-ink mb-2">まだ投稿がありません</h2>
      <p className="text-sm text-gray-400 leading-relaxed max-w-[220px]">
        出店者の投稿が届いたら<br />ここに表示されます
      </p>
      <div className="mt-6 flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 rounded-full px-4 py-2 border border-gray-100">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
        </svg>
        次の日曜市は {nextSunday}
      </div>
    </div>
  );
}

