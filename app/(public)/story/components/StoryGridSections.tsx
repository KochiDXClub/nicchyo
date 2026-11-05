"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Heart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getStoryAgeBucket, STORY_AGE_LABEL, STORY_AGE_ORDER } from "../age";
import type { StoryItem } from "../types";
import { formatRelativeTime } from "./StoryChrome";

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
  const recentCount = sections
    .filter((section) => section.bucket !== "older")
    .reduce((sum, section) => sum + section.items.length, 0);
  const hasRecent = recentCount > 0;
  // 「それより前」を最初から開くかは、最初に描いたときの投稿で一度だけ決める。
  // StoryGridClient は読み込みが終わってからこの一覧を描くので、ここに来た時点で投稿はそろっている
  // （読み込み中も一覧を出す・投稿を読み直す形に変えるなら、開き方の決め直しが要る）
  const [olderOpen, setOlderOpen] = useState(!hasRecent);

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        const isOlder = section.bucket === "older";
        const label = STORY_AGE_LABEL[section.bucket];
        const list = (
          <StoryList items={section.items} heartCounts={heartCounts} onOpen={onOpen} />
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

};

function StoryList({ items, heartCounts, onOpen }: ListProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ story, index }) => {
        const shopName = story.vendor?.shop_name ?? "出店者";
        const hearts = heartCounts[story.id] ?? 0;
        return (
          <li key={story.id}>
            <button
              type="button"
              onClick={() => onOpen(index)}
              className="group relative block aspect-video w-full overflow-hidden rounded-card bg-nicchyo-ink/5 text-left transition active:scale-[0.97] motion-reduce:active:scale-100 sm:aspect-square"
              aria-label={`${shopName}の投稿を見る`}
            >
              <StoryTileBody story={story} shopName={shopName} hearts={hearts} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type BodyProps = { story: StoryItem; shopName: string; hearts: number };

function StoryTileBody({ story, shopName, hearts }: BodyProps) {
  return (
    <>
      <Image
        src={story.image_url}
        alt=""
        fill
        className="object-cover transition duration-300 md:group-hover:scale-[1.03]"
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-6">
        <p className="truncate text-sm font-bold leading-tight text-white">{shopName}</p>
        <p className="mt-1 text-xs text-white">{formatRelativeTime(new Date(story.created_at))}</p>
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
