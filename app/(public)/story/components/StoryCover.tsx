"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { StoryItem } from "../types";
import {
  formatRelativeTime,
  StoryCharacterBubble,
  StoryDemoBadge,
  StoryProgressBars,
  StoryShopInfo,
} from "./StoryChrome";

type Props = {
  story: StoryItem;
  /** 経過バーの本数（全投稿の数） */
  count: number;
  /** 名札の右に置く操作（閉じるボタンなど） */
  headerAction?: ReactNode;
  /** 下端に重ねるもの（「上にスワイプ」の案内など）。本文の下に並ぶ */
  footer?: ReactNode;
  /** 画像の読み込みを優先するか。最初の画面に出るときだけ true */
  priority?: boolean;
  /** デモの投稿か。名札の横に「デモ」の印を出す */
  demo?: boolean;
};

/**
 * 再生を始める前のストーリー。全画面ビューア（StoryViewer）を開いた瞬間と
 * 同じ並び（経過バー・名札・写真・本文）で、先頭の投稿を止めたまま見せる。
 * 開くとそのまま再生が始まるように見せるための「表紙」。
 * 写真の収め方もビューアと同じ（切り取らずに全体を収める）にして、引き上げて
 * ビューアに切り替わった瞬間に写真が動かないようにしている。
 *
 * 大きさは親が決める（スマホは半開きのシート、PC は縦長のカード）。
 */
export default function StoryCover({ story, count, headerAction, footer, priority, demo }: Props) {
  const shopName = story.vendor?.shop_name ?? "出店者";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-left">
      <Image
        src={story.image_url}
        alt={story.body ?? shopName}
        fill
        className="object-contain select-none"
        sizes="(min-width: 768px) 360px, 100vw"
        draggable={false}
        priority={priority}
      />

      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-4">
        <StoryProgressBars count={count} index={0} />
        <div className="flex items-center gap-2.5">
          <StoryShopInfo
            shopName={shopName}
            avatarUrl={story.vendor?.shop_image_url ?? null}
            timeLabel={formatRelativeTime(new Date(story.created_at))}
          />
          {demo && <StoryDemoBadge />}
          {headerAction}
        </div>
      </div>

      {(story.body || story.character || footer) && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-16">
          {story.character && <StoryCharacterBubble character={story.character} className="mb-3" />}
          {story.body && (
            <p className="line-clamp-3 text-sm leading-relaxed text-white">{story.body}</p>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
