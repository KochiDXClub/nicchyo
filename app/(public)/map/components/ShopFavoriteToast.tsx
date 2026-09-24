"use client";

import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * 商品をお気に入りに入れたときの知らせ。
 *
 * 画面の幅いっぱいの箱を敷いてから中身を中央に置く。以前は要素そのものを
 * left:50% + translate で中央に寄せていたため、商品名が長いと箱が画面より
 * 広がり、左右にはみ出していた。
 * 位置は下部ナビとセーフエリアの上。ページ側のトーストと同じ高さに合わせる。
 */
export function ShopFavoriteToast({
  product,
  onUndo,
  reduceMotion,
}: {
  product: string | null;
  onUndo: (product: string) => void;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 z-[3100] px-4"
          style={{ bottom: "calc(4.75rem + var(--safe-bottom, 0px))" }}
        >
          <div className="pointer-events-auto mx-auto flex max-w-sm items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Heart className="h-4 w-4" fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{product}</p>
              <p className="text-[12px] text-white/65">お気に入りに入れました</p>
            </div>
            <button
              type="button"
              onClick={() => onUndo(product)}
              className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold transition hover:bg-white/25 active:scale-95"
            >
              取り消す
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
