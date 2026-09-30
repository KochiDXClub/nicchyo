"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { MapPin } from "lucide-react";
import { buttonClass } from "@/components/ui";
import type { StoryItem } from "../types";
import { formatRelativeTime } from "./StoryChrome";

/** これだけ下へ引いて離したら閉じる（px） */
const DISMISS_DISTANCE = 80;
/** これより速く下へ払ったら、距離に関係なく閉じる（px/s） */
const DISMISS_VELOCITY = 450;

type Props = {
  open: boolean;
  story: StoryItem;
  onClose: () => void;
};

/**
 * ストーリーの下から出す「詳しく」のシート。
 *
 * ストーリーの上の主役は店のAIキャラのひとことで、店主の書いた説明は二番目の情報として
 * ここにまとめる（説明書のように、あとから落ち着いて読める場所）。
 * 全画面ビューア（StoryViewer）の枠の中に重ねるので、PC でも縦長の枠の中に出る。
 *
 * - ビューアの指の操作（左右タップで送る・長押しで止める）とぶつからないよう、
 *   シートと背景の上で始まった押し始めはビューアへ伝えない
 * - 下へ引いて閉じるのは、つまみと見出しの上で始めたときだけ。本文の上の指は
 *   本文のスクロールに使う（長い説明文を下まで読めるようにする）
 * - 開いたらシートへフォーカスを移し、閉じたら開く前の場所（「詳しく」ボタン）へ戻す
 */
export default function StoryDetailSheet({ open, story, onClose }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLElement>(null);
  const shopName = story.vendor?.shop_name ?? "出店者";
  const avatarUrl = story.vendor?.shop_image_url ?? null;
  const storeNumber = story.vendor?.store_number ?? null;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        // 押し始め（pointerdown）だけをビューアへ伝えなければ、タップ送り・長押しは始まらない。
        // move / up まで止めると、window で指を追う framer-motion のドラッグが終わらなくなる
        <div className="absolute inset-0 z-30" onPointerDown={stopPointer}>
          <motion.button
            type="button"
            aria-label="詳しくを閉じる"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="absolute inset-0 bg-black/45"
          />
          <motion.section
            ref={sheetRef}
            role="dialog"
            aria-label={`${shopName}の詳しい情報`}
            tabIndex={-1}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="absolute inset-x-0 bottom-0 flex max-h-[70%] flex-col rounded-t-sheet bg-nicchyo-base text-nicchyo-ink shadow-float outline-none"
          >
            {/* つまみと見出し：ここで始めた指だけがシートを下へ引ける */}
            <div
              className="flex-shrink-0 touch-none px-5 pt-3"
              onPointerDown={(e) => dragControls.start(e)}
              data-testid="story-detail-drag-handle"
            >
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-chip bg-nicchyo-ink/20" />
              <div className="flex items-center gap-3 pb-1">
                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-nicchyo-soft-green">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" fill sizes="40px" className="object-cover" />
                  ) : (
                    <span className="text-sm font-bold">{shopName.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight">{shopName}</p>
                  <p className="text-xs text-nicchyo-ink/55">
                    {formatRelativeTime(new Date(story.created_at))}の投稿
                  </p>
                </div>
              </div>
            </div>

            {/* 本文：長い説明文は、ここだけを縦にスクロールして読む */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8"
              style={{ touchAction: "pan-y", paddingBottom: "calc(2rem + var(--safe-bottom, 0px))" }}
            >
              {story.body && (
                <div className="mt-4">
                  <p className="text-[11px] font-bold tracking-wide text-nicchyo-ink/55">お店から</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed">{story.body}</p>
                </div>
              )}

              {storeNumber != null && (
                <Link
                  href={`/map?shop=${storeNumber}`}
                  className={buttonClass({ variant: "secondary", className: "mt-6 w-full gap-2" })}
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  マップでお店を見る
                </Link>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
