"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getStoryAgeBucket, STORY_AGE_LABEL, STORY_AGE_ORDER } from "../age";
import type { StoryItem } from "../types";
import { formatRelativeTime } from "./StoryChrome";

/**
 * これ以下の件数なら、写真だけのグリッドではなく、本文の冒頭まで読めるカードで並べる。
 * 投稿が少ないうちは、タイルが店名だけになって中身がわからず、右側も空いてしまうため。
 */
export const STORY_CARD_LAYOUT_MAX = 6;

type Props = {
  /** 新しい順の全投稿 */
  stories: StoryItem[];
  heartCounts: Record<string, number>;
  /** stories の index で全画面ビューアを開く */
  onOpen: (index: number) => void;
};

type Entry = { story: StoryItem; index: number };

/**
 * 投稿を週ごと（今週・先週・それより前）に区切った一覧。
 *
 * 来訪者が知りたいのは「今度の日曜に何があるか」なので、「それより前」は
 * 既定でたたむ（今週・先週の投稿が1件もないときだけ開いておく）。
 */
export default function StoryGridSections({ stories, heartCounts, onOpen }: Props) {
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
  const hasRecent = sections.some((section) => section.bucket !== "older");
  const [olderOpen, setOlderOpen] = useState(!hasRecent);
  const asCards = stories.length <= STORY_CARD_LAYOUT_MAX;

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const isOlder = section.bucket === "older";
        const label = STORY_AGE_LABEL[section.bucket];
        const list = (
          <StoryList items={section.items} heartCounts={heartCounts} onOpen={onOpen} asCards={asCards} />
        );

        if (!isOlder) {
          return (
            <section key={section.bucket} aria-label={label}>
              <SectionHeading label={label} count={section.items.length} />
              {list}
            </section>
          );
        }

        return (
          <section key={section.bucket} aria-label={label}>
            <h2>
              <button
                type="button"
                onClick={() => setOlderOpen((prev) => !prev)}
                aria-expanded={olderOpen}
                className="flex w-full items-center gap-2 rounded-btn py-1 text-left"
              >
                <span className="text-sm font-bold text-nicchyo-ink">{label}</span>
                <span className="text-[11px] font-normal text-nicchyo-ink/55">{section.items.length}件</span>
                <ChevronDown
                  className={cn("ml-auto h-4 w-4 text-nicchyo-ink/55 transition-transform", olderOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
            </h2>
            {olderOpen && (
              <>
                <p className="mb-3 mt-1 text-xs text-nicchyo-ink/55">
                  2週間以上前の投稿です。いまは扱っていない品もあります。
                </p>
                {list}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h2 className="text-sm font-bold text-nicchyo-ink">{label}</h2>
      <span className="text-[11px] text-nicchyo-ink/55">{count}件</span>
    </div>
  );
}

type ListProps = {
  items: Entry[];
  heartCounts: Record<string, number>;
  onOpen: (index: number) => void;
  /**
   * true … 写真＋店名・投稿時刻・本文の冒頭が読めるカード（件数が少ないとき）
   * false … 写真のタイルを3列（PC は4列）で並べる（件数が多いとき）
   */
  asCards: boolean;
};

function StoryList({ items, heartCounts, onOpen, asCards }: ListProps) {
  return (
    <ul className={asCards ? "grid gap-2 md:grid-cols-2 md:gap-3" : "grid grid-cols-3 gap-1 md:grid-cols-4 md:gap-1.5"}>
      {items.map(({ story, index }) => {
        const shopName = story.vendor?.shop_name ?? "出店者";
        const hearts = heartCounts[story.id] ?? 0;
        return (
          <li key={story.id}>
            <button
              type="button"
              onClick={() => onOpen(index)}
              className={cn(
                "transition motion-reduce:active:scale-100",
                asCards
                  ? "flex w-full items-stretch gap-3 rounded-card bg-white p-2 text-left shadow-card ring-1 ring-line active:scale-[0.99]"
                  : "group relative block aspect-[3/4] w-full overflow-hidden rounded-btn bg-nicchyo-ink/5 active:scale-[0.97]"
              )}
              aria-label={`${shopName}の投稿を見る`}
            >
              {asCards ? (
                <StoryCardBody story={story} shopName={shopName} hearts={hearts} />
              ) : (
                <StoryTileBody story={story} shopName={shopName} hearts={hearts} />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type BodyProps = { story: StoryItem; shopName: string; hearts: number };

function StoryCardBody({ story, shopName, hearts }: BodyProps) {
  return (
    <>
      <div className="relative aspect-[3/4] w-20 flex-shrink-0 overflow-hidden rounded-btn bg-nicchyo-ink/5">
        <Image src={story.image_url} alt="" fill className="object-cover" sizes="80px" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-nicchyo-ink">{shopName}</p>
          <span className="flex-shrink-0 text-[11px] text-nicchyo-ink/55">
            {formatRelativeTime(new Date(story.created_at))}
          </span>
        </div>
        {story.body && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-nicchyo-ink/70">{story.body}</p>
        )}
        {hearts > 0 && (
          <span className="mt-auto flex items-center gap-1 pt-1 text-[11px] font-semibold tabular-nums text-nicchyo-ink/55">
            <Heart className="h-3 w-3 fill-current text-rose-400" aria-hidden />
            {hearts}
          </span>
        )}
      </div>
    </>
  );
}

function StoryTileBody({ story, shopName, hearts }: BodyProps) {
  return (
    <>
      <Image
        src={story.image_url}
        alt=""
        fill
        className="object-cover transition duration-300 md:group-hover:scale-[1.03]"
        sizes="(min-width: 768px) 180px, 33vw"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-6">
        <p className="truncate text-[11px] font-semibold leading-tight text-white">{shopName}</p>
      </div>
      {hearts > 0 && (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 backdrop-blur-sm">
          <Heart className="h-2.5 w-2.5 fill-current text-rose-400" aria-hidden />
          <span className="text-[9px] font-bold tabular-nums text-white">{hearts}</span>
        </div>
      )}
    </>
  );
}
