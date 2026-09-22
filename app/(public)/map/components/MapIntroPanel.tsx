'use client';

/**
 * MapIntroPanel
 *
 * 初来訪者に「ここが何のサービスか」を伝える案内パネル。
 *
 * 独立した LP ページではなく、読み込み終わったマップの上に下から重ねる。
 * 全画面で覆わず上に地図を残すのは、「説明を読まされてからマップへ行く」ではなく
 * 「マップに来ていて、その上に説明が出ている」にするため。
 * 見えている地図はタップでそのまま閉じられる。
 *
 * 出す条件は useMapIntro が持つ。ここは見た目と閉じ方だけを受け持つ。
 */

import { motion, useDragControls } from 'framer-motion';
import NextImage from 'next/image';
import Link from 'next/link';
import { Map as MapIcon, MessageCircle, Search, X } from 'lucide-react';

type MapIntroPanelProps = {
  onClose: () => void;
};

const FEATURES = [
  {
    icon: MapIcon,
    title: '地図で探す',
    body: '並んでいる店がそのまま地図に。タップで写真と品物が見られます。',
  },
  {
    icon: Search,
    title: '検索でしぼる',
    body: '「野菜」「果物」などのジャンルや、お店の名前から。',
  },
  {
    icon: MessageCircle,
    title: 'にちよさんに聞く',
    body: '「おすすめのランチは？」と話しかけると AI が案内します。',
  },
] as const;

export default function MapIntroPanel({ onClose }: MapIntroPanelProps) {
  const dragControls = useDragControls();

  return (
    <>
      {/* 上に見えている地図。暗幕は敷かず、タップで閉じられるようにする */}
      <motion.button
        type="button"
        key="map-intro-dismiss-area"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        aria-label="案内を閉じて地図を見る"
        className="fixed inset-0 z-[9988] cursor-default bg-transparent"
      />

      <motion.div
        key="map-intro-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose();
        }}
        role="dialog"
        aria-modal="false"
        aria-labelledby="map-intro-title"
        className="fixed inset-x-0 bottom-0 z-[9990] mx-auto w-full max-w-lg rounded-t-[28px] bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07]"
      >
        {/* ドラッグハンドル。下へ払っても閉じる */}
        <div
          className="flex h-7 w-full cursor-grab items-center justify-center active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
        >
          <div className="h-1 w-10 rounded-full bg-nicchyo-ink/15" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-4 top-4 rounded-full p-1.5 text-nicchyo-ink/40 transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 読み物は縦に詰まった端末ではスクロールさせ、「地図をみる」は常に見えるところに残す */}
        <div className="max-h-[52dvh] overflow-y-auto px-5 pt-1">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-nicchyo-accent/25">
              <NextImage
                src="/images/obaasan_transparent.png"
                alt=""
                fill
                sizes="56px"
                className="object-cover object-top"
              />
            </div>
            <div className="min-w-0">
              <h2 id="map-intro-title" className="text-[19px] font-bold leading-tight text-nicchyo-ink">
                ようこそ、日曜市へ
              </h2>
              <p className="mt-0.5 text-[12px] font-semibold tracking-wide text-nicchyo-ink/45">
                nicchyo（ニッチョ）
              </p>
            </div>
          </div>

          <p className="mt-3 text-[13.5px] leading-relaxed text-nicchyo-ink/75">
            毎週日曜、高知城のふもとから追手筋にかけて約300の店が並びます。
            この地図は、はじめての人がそこを歩くためのものです。
          </p>

          <ul className="mt-3 space-y-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex gap-3 rounded-2xl bg-white/70 px-3.5 py-2.5 ring-1 ring-nicchyo-ink/[0.06]"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nicchyo-soft-green/35 text-nicchyo-ink/70">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-nicchyo-ink">{title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-nicchyo-ink/65">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ナビゲーションバー（h-14）に隠れないよう、その分だけ下に余白を取る */}
        <div
          className="relative px-5 pt-4"
          style={{ paddingBottom: 'calc(3.5rem + var(--safe-bottom, 0px) + 1rem)' }}
        >
          {/* 上の読み物が切れているときに、続きがあることが分かるようにぼかす */}
          <div
            className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-nicchyo-base to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-nicchyo-primary py-3.5 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(126,217,87,0.9)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2"
          >
            地図をみる
          </button>

          <Link
            href="/about"
            className="mt-3 block text-center text-[12.5px] font-semibold text-nicchyo-ink/45 underline-offset-4 hover:underline"
          >
            nicchyo について詳しく
          </Link>
        </div>
      </motion.div>
    </>
  );
}
