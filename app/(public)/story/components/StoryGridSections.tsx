"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Heart } from "lucide-react";
import { getStoryAgeBucket, STORY_AGE_LABEL, STORY_AGE_ORDER } from "../age";
import type { StoryItem } from "../types";

/** 「それより前」は既定で2行ぶんだけ見せ、古い投稿でページが間延びしないようにする */
const OLDER_PREVIEW_COUNT = 6;

type Props = {
  /** 新しい順の全投稿 */
  stories: StoryItem[];
  heartCounts: Record<string, number>;
  /** stories の index で全画面ビューアを開く */
  onOpen: (index: number) => void;
};

/** 投稿を週ごと（今週・先週・それより前）に区切ったサムネイルの一覧 */
export default function StoryGridSections({ stories, heartCounts, onOpen }: Props) {
  const [showAllOlder, setShowAllOlder] = useState(false);

  // index は元の stories（新しい順）の位置なので、ビューアの initialIndex と整合する
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

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const isOlder = section.bucket === "older";
        const hasMore = isOlder && section.items.length > OLDER_PREVIEW_COUNT;
        const visibleItems =
          hasMore && !showAllOlder ? section.items.slice(0, OLDER_PREVIEW_COUNT) : section.items;

        return (
          <section key={section.bucket} aria-label={STORY_AGE_LABEL[section.bucket]}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-bold text-nicchyo-ink">{STORY_AGE_LABEL[section.bucket]}</h2>
              <span className="text-[11px] text-nicchyo-ink/55">{section.items.length}件</span>
            </div>
            <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-card md:grid-cols-4 md:gap-1.5 md:overflow-visible md:rounded-none">
              {visibleItems.map(({ story, index }) => {
                const shopName = story.vendor?.shop_name ?? "出店者";
                const hearts = heartCounts[story.id] ?? 0;
                return (
                  <li key={story.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(index)}
                      className="group relative block aspect-[3/4] w-full overflow-hidden bg-nicchyo-ink/5 transition active:scale-[0.97] motion-reduce:active:scale-100 md:rounded-btn"
                      aria-label={`${shopName}の投稿を見る`}
                    >
                      <Image
                        src={story.image_url}
                        alt=""
                        fill
                        className="object-cover transition duration-300 md:group-hover:scale-[1.03]"
                        sizes="(min-width: 768px) 180px, 33vw"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-6">
                        <p className="truncate text-[11px] font-semibold leading-tight text-white">
                          {shopName}
                        </p>
                      </div>
                      {hearts > 0 && (
                        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
                          <Heart className="h-2.5 w-2.5 fill-current text-rose-400" aria-hidden />
                          <span className="text-[9px] font-bold tabular-nums text-white">{hearts}</span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAllOlder((prev) => !prev)}
                aria-expanded={showAllOlder}
                className="mt-2 flex w-full items-center justify-center gap-1 py-2 text-xs font-semibold text-nicchyo-ink/70"
              >
                {showAllOlder ? "閉じる" : `すべて見る（${section.items.length}件）`}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAllOlder ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
