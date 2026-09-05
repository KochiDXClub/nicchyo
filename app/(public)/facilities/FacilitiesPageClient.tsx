'use client';

/**
 * おでかけサポートのトップ画面。
 *
 * ヘッダーは /story（近況ページ）と同じ「色つきの霧」演出を流用し、
 * お手洗い＝空色・休けい＝緑・のりもの＝あめ色の3つの霧を漂わせることで、
 * 下のカテゴリボックスと配色がひと目でつながるようにしてある。
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import NavigationBar from '../../components/NavigationBar';
import { FACILITY_CATEGORIES, type FacilityCategoryId } from '@/lib/facilities/facilities';
import { GUIDE_PRESETS } from '@/lib/guide/presets';
import { guideHrefForPreset } from '@/lib/guide/query';

type FacilitiesPageClientProps = {
  /**
   * カテゴリごとの件数。施設データは map_landmarks が唯一の情報源なので、
   * サーバー側で数えた値を親から受け取る。
   */
  counts: Record<FacilityCategoryId, number>;
};

export default function FacilitiesPageClient({ counts }: FacilitiesPageClientProps) {
  return (
    <main className="relative min-h-screen bg-[#FDFBF7] pb-28 text-gray-900">
      {/* 見出し：/story と同じ霧のヒーロー演出。吹き出し状のカードは使わず、
          テキストを直接置いて背景に溶け込ませる */}
      <div className="relative overflow-hidden px-4 pb-8 pt-safe-top">
        <motion.div
          aria-hidden
          animate={{
            x: [0, 90, -60, 0],
            y: [0, 26, -16, 0],
            scale: [1, 1.14, 0.93, 1],
            opacity: [0.75, 0.32, 0.75],
          }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -left-10 -top-14 h-56 w-56 rounded-full bg-sky-400/35 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{
            x: [0, -70, 85, 0],
            y: [0, 22, -24, 0],
            scale: [1, 0.9, 1.16, 1],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          className="pointer-events-none absolute left-1/4 -top-8 h-48 w-48 rounded-full bg-emerald-400/35 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{
            x: [0, -85, 65, 0],
            y: [0, -18, 20, 0],
            scale: [1, 1.12, 0.92, 1],
            opacity: [0.28, 0.72, 0.28],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="pointer-events-none absolute -right-8 top-0 h-52 w-52 rounded-full bg-amber-400/35 blur-3xl"
        />
        <div
          aria-hidden
          className="story-fog-grain pointer-events-none absolute inset-0 opacity-[0.45] mix-blend-overlay"
        />

        <div className="relative mx-auto max-w-lg pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-amber-600">
            Odekake Support
          </p>
          <h1 className="mt-1 text-[2.25rem] font-black leading-none tracking-tight text-gray-900">
            おでかけサポート
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            さがしたいものをえらぶと、マップで場所を光らせてご案内します。
            現在地がわかるときは、一番近い場所までの道のりもお知らせします。
          </p>
        </div>
      </div>

      <div className="relative mx-auto max-w-lg px-4">
        {/* 目的からえらぶ（プリセット） */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">いま、どうしたい？</p>
        <ul className="mb-8 grid grid-cols-2 gap-3">
          {GUIDE_PRESETS.map((preset) => (
            <li key={preset.id}>
              <Link
                href={guideHrefForPreset(preset.id)}
                className="flex h-full items-center gap-2.5 rounded-2xl border border-amber-100 bg-white px-3 py-3 shadow-sm transition active:scale-[0.98]"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {preset.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">{preset.label}</span>
                  <span className="block text-[10px] leading-snug text-gray-500">{preset.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 3つのカテゴリボックス */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-600">種類からさがす</p>
        <ul className="space-y-4">
          {FACILITY_CATEGORIES.map((category, i) => (
            <li key={category.id}>
              <Link
                href={`/map?facility=${category.id}`}
                className={`group flex min-h-[104px] items-center gap-4 rounded-3xl border-2 px-5 py-5 shadow-sm transition active:scale-[0.98] ${category.boxClass}`}
              >
                {category.iconUrl ? (
                  <span className="h-11 w-11 shrink-0" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={category.iconUrl}
                      alt=""
                      className="h-full w-full object-contain drop-shadow-sm"
                      draggable={false}
                    />
                  </span>
                ) : (
                  <span className="text-4xl leading-none" aria-hidden="true">
                    {category.emoji}
                  </span>
                )}
                <span className="flex-1">
                  <span className="block text-lg font-bold">{category.label}</span>
                  <span className="mt-1 block text-sm opacity-80">{category.description}</span>
                  <span className="mt-1 block text-xs opacity-60">
                    {counts[category.id]}
                    か所
                  </span>
                </span>
                {/* 「こちらへどうぞ」の誘導として、軽く右へ揺れ続けるシェブロン。
                    3件を少しずつ位相をずらし、全部が同時に動いて騒がしくならないようにする */}
                <motion.svg
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 opacity-40 transition-opacity group-active:opacity-70"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.25,
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </motion.svg>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
          掲載している情報は変わることがあります。当日の最新の状況は、現地の案内表示をご確認ください。
        </p>
      </div>

      <NavigationBar />
    </main>
  );
}
