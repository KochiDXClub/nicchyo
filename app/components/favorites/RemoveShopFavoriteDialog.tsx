"use client";

/**
 * お店ごとお気に入りから外すときの確認。
 *
 * 店のハートを外すと、その店にぶら下げた商品も一緒に消える。商品を1つずつ
 * 入れた手間が1タップで消えるので、商品があるときだけここを通す。
 * 画面ごとに別の確認を持つと「同じハートなのに画面によって壊れ方が違う」
 * ことになるので、確認はこの1つに揃える。
 */

import { AnimatePresence, motion } from "framer-motion";

export default function RemoveShopFavoriteDialog({
  productCount,
  open,
  onCancel,
  onConfirm,
  reduceMotion,
  zIndexClassName = "z-[3200]",
}: {
  /** 一緒に消える商品の数 */
  productCount: number;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  reduceMotion: boolean;
  /** 重ねる相手（バナー・シート）に合わせて前後関係を変えられるようにする */
  zIndexClassName?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          className={`fixed inset-0 ${zIndexClassName} flex items-end justify-center bg-slate-950/40 px-4 backdrop-blur-[2px] sm:items-center`}
          style={{ paddingBottom: "calc(2rem + var(--safe-bottom, 0px))" }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="お気に入りから外す確認"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-base font-bold text-slate-900">お気に入りから外しますか？</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              このお店に入れている{productCount}品も一緒に消えます。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 flex-1 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-11 flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-black"
              >
                外す
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
