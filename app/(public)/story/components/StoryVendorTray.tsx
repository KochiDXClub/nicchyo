"use client";

import { useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { getStoryAgeBucket } from "../age";
import type { StoryItem } from "../types";

type Props = {
  /** 新しい順の全投稿 */
  stories: StoryItem[];
  /** 押された店のいちばん新しい投稿の位置（stories の index）で開く */
  onOpen: (index: number) => void;
};

/**
 * 投稿している店を、新しく投稿した順に丸いアイコンで横に並べる。
 * 店から近況を見たい人の入口。今週投稿した店は緑の輪で囲む。
 */
export default function StoryVendorTray({ stories, onOpen }: Props) {
  const vendors = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ key: string; name: string; imageUrl: string; index: number; fresh: boolean }> = [];
    stories.forEach((story, index) => {
      const key = story.vendor?.id ?? `story-${story.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        key,
        name: story.vendor?.shop_name ?? "出店者",
        imageUrl: story.vendor?.shop_image_url ?? story.image_url,
        index,
        fresh: getStoryAgeBucket(story.created_at) === "this_week",
      });
    });
    return list;
  }, [stories]);

  if (vendors.length === 0) return null;

  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex gap-3">
        {vendors.map((vendor) => (
          <li key={vendor.key} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(vendor.index)}
              className="flex w-[4.25rem] flex-col items-center gap-1.5 transition active:scale-95 motion-reduce:active:scale-100"
              aria-label={`${vendor.name}の近況を見る`}
            >
              <span
                className={cn(
                  "rounded-full p-[2.5px]",
                  vendor.fresh ? "bg-nicchyo-primary" : "bg-nicchyo-ink/15"
                )}
              >
                <span className="block rounded-full bg-nicchyo-base p-[2px]">
                  <span className="relative block h-14 w-14 overflow-hidden rounded-full bg-nicchyo-soft-green">
                    <Image
                      src={vendor.imageUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </span>
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] leading-tight text-nicchyo-ink/70">
                {vendor.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
