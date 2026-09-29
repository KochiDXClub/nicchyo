"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
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
 * ビューアの指の操作（左右タップで送る・長押しで止める）とぶつからないよう、
 * シートと背景の上で始まった指はビューアへ伝えない。
 */
export default function StoryDetailSheet({ open, story, onClose }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const shopName = story.vendor?.shop_name ?? "出店者";
  const avatarUrl = story.vendor?.shop_image_url ?? null;
  const storeNumber = story.vendor?.store_number ?? null;

  const stopPointer = (e: React.PointerEvent) => e.stopPropagation();

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-30"
          onPointerDown={stopPointer}
          onPointerUp={stopPointer}
          onPointerMove={stopPointer}
        >
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
            role="dialog"
            aria-label={`${shopName}の詳しい情報`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto rounded-t-sheet bg-nicchyo-base px-5 pb-8 pt-3 text-nicchyo-ink shadow-float"
            style={{ paddingBottom: "calc(2rem + var(--safe-bottom, 0px))" }}
          >
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-chip bg-nicchyo-ink/20" />

            <div className="flex items-center gap-3">
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

            {story.body && (
              <div className="mt-5">
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
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
