"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { StoryItem } from "./types";

export default function StoryGridClient() {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const nextSunday = useMemo(() => getNextSundayLabel(), []);

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

  // 鮮度バケット（今週/1週間前/1か月前）ごとにまとめる。index は元の
  // stories 配列（新しい順）の位置なので、ビューアの initialIndex と整合する。
  const sections = useMemo(
    () =>
      STORY_AGE_ORDER.map((bucket) => ({
        bucket,
        items: stories
          .map((story, index) => ({ story, index }))
          .filter(({ story }) => getStoryAgeBucket(story.created_at) === bucket),
      })).filter((section) => section.items.length > 0),
    [stories]
  );

  // API が提灯ローディング中に失敗した場合は、待たずにエラー表示へ進む
  if (pageLoading && !fetchError) return <LoadingLantern />;

  return (
    <main className="min-h-screen bg-nicchyo-base pb-28">
      {/* ヘッダー */}
      <div className="bg-white px-4 pt-10 pb-4 border-b border-gray-100">
        <div className="mx-auto max-w-lg flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-nicchyo-ink tracking-tight">近況</h1>
            <p className="mt-0.5 text-xs text-gray-400">出店者の近況・新しいほど鮮やか</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 rounded-full px-3 py-1.5 border border-gray-100">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
            <span>古いほど色あせる</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5">
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

