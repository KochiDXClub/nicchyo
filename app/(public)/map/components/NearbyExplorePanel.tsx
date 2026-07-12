'use client';

/**
 * NearbyExplorePanel
 *
 * 「このへん、なにがある？」ボタンをタップした直後に表示する浮遊シート。
 * 決定論的な内容（字幕・ジャンル内訳バー・写真列）を即座に見せ、
 * "AIの一言" だけが少し遅れてフェードインする（Google の AI Overview 方式）。
 *
 * UI はドラッグ可能なボトムシート（2段スナップ）:
 * - ピーク: コンパクト表示（写真は横スクロール1行）
 * - 展開:   画面の約65%（写真はグリッドに広がる）
 * - ハンドルを下にスワイプ → ピークに戻る／ピークから更に下で閉じる
 * - 地図が動いたときは親側の move リスナーで自動的に閉じる
 *
 * 「地図が主役」の原則を守るため全画面には広がらない。
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, useDragControls } from 'framer-motion';
import { CONSULT_CHARACTER_BY_ID } from '../../consult/data/consultCharacters';
import type { NearbyViewportSummary } from '../utils/viewportSummary';

/** "AIの一言" がフェードインするまでの時間（考えている感の演出） */
const NOTE_REVEAL_DELAY_MS = 1400;

/** ジャンル内訳バーの色（積み上げバーと凡例で共通） */
const GENRE_COLORS: Record<string, string> = {
  '食材': '#7ED957',
  '食べ物': '#F59E0B',
  '道具・工具': '#64748B',
  '生活雑貨': '#38BDF8',
  '植物・苗': '#14B8A6',
  'アクセサリー': '#F472B6',
  '手作り・工芸': '#A78BFA',
};
const FALLBACK_GENRE_COLOR = '#94A3B8';

export type NearbyPhotoEntry = {
  shopId: number;
  name: string;
  imageUrl: string;
};

/** ピーク＝コンパクト表示が収まる高さ、展開＝画面の約65%（全画面にはしない） */
function getSnapHeights() {
  if (typeof window === 'undefined') {
    return { peek: 320, expanded: 480 };
  }
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return {
    peek: Math.min(320, Math.round(viewportHeight * 0.45)),
    expanded: Math.round(viewportHeight * 0.65),
  };
}

function PhotoThumb({
  photo,
  onSelect,
  fill,
}: {
  photo: NearbyPhotoEntry;
  onSelect: (shopId: number) => void;
  /** true なら親グリッドいっぱいに広がる（展開時） */
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(photo.shopId)}
      className={`shrink-0 text-left transition-transform active:scale-95 ${
        fill ? 'w-full' : 'w-[76px]'
      }`}
    >
      <div
        className={`overflow-hidden rounded-xl bg-slate-100 ${
          fill ? 'aspect-[4/3] w-full' : 'h-[56px] w-[76px]'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={photo.name}
          className="h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>
      <p className="mt-0.5 truncate text-[10px] font-medium text-slate-600">
        {photo.name}
      </p>
    </button>
  );
}

export default function NearbyExplorePanel({
  summary,
  photos,
  note,
  onSelectShop,
  onAsk,
  onClose,
}: {
  summary: NearbyViewportSummary;
  /** 範囲内の風景・店舗写真（定点風景写真が揃うまでは店舗写真で代用） */
  photos: NearbyPhotoEntry[];
  /** 遅れてフェードインする"AIの一言" */
  note: string;
  onSelectShop: (shopId: number) => void;
  onAsk: (question: string) => void;
  /** ハンドルを下にスワイプしたときに閉じる */
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [snapHeights] = useState(getSnapHeights);
  const dragControls = useDragControls();
  const hasShops = summary.totalCount > 0;
  const areaLabel =
    summary.chomeLabels.length > 0
      ? `${summary.chomeLabels.join('・')}のあたり`
      : 'このあたり';
  const character = CONSULT_CHARACTER_BY_ID.get('nichiyosan');

  useEffect(() => {
    const timer = setTimeout(() => setNoteVisible(true), NOTE_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    const text = question.trim();
    if (!text) return;
    onAsk(text);
  };

  return (
    <div className="pointer-events-none absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] left-4 right-4 z-[1300]">
      <motion.div
        className="pointer-events-auto mx-auto flex max-w-xl flex-col overflow-hidden rounded-[24px] border border-amber-200 bg-white/[0.97] shadow-[0_28px_60px_rgba(15,23,42,0.22)]"
        initial={{ opacity: 0, y: 16, height: snapHeights.peek }}
        animate={{
          opacity: 1,
          y: 0,
          height: expanded ? snapHeights.expanded : snapHeights.peek,
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.25, bottom: 0.25 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -48 || info.velocity.y < -500) {
            setExpanded(true);
            return;
          }
          if (info.offset.y > 56 || info.velocity.y > 500) {
            if (expanded) {
              setExpanded(false);
            } else {
              onClose();
            }
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div
          className="flex shrink-0 cursor-grab justify-center py-2 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
          aria-label={expanded ? '下にスワイプで縮小' : '上にスワイプで展開'}
        >
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* 縦スクロール領域 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* 字幕1行 + ジャンル内訳バー */}
          <div className="px-4 pb-2">
            <p className="text-[14px] font-bold leading-tight text-slate-900">
              {hasShops ? (
                <>
                  {areaLabel}に{' '}
                  <span className="text-amber-700">{summary.totalCount}店</span>
                </>
              ) : (
                `${areaLabel}にはお店が見当たりません`
              )}
            </p>
            {hasShops && (
              <>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  {summary.genres.map((genre) => (
                    <div
                      key={genre.category}
                      style={{
                        width: `${(genre.count / summary.totalCount) * 100}%`,
                        backgroundColor:
                          GENRE_COLORS[genre.category] ?? FALLBACK_GENRE_COLOR,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5">
                  {summary.genres.slice(0, 4).map((genre) => (
                    <span
                      key={genre.category}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            GENRE_COLORS[genre.category] ?? FALLBACK_GENRE_COLOR,
                        }}
                      />
                      {genre.category} {genre.count}
                    </span>
                  ))}
                  {summary.genres.length > 4 && (
                    <span className="text-[10px] font-medium text-slate-400">
                      ほか{summary.genres.length - 4}ジャンル
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* 写真: ピーク時は横スクロール1行、展開時はグリッド */}
          {photos.length > 0 &&
            (expanded ? (
              <div className="grid grid-cols-4 gap-2 px-4 pb-2">
                {photos.map((photo) => (
                  <PhotoThumb
                    key={photo.shopId}
                    photo={photo}
                    onSelect={onSelectShop}
                    fill
                  />
                ))}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-0.5">
                {photos.map((photo) => (
                  <PhotoThumb
                    key={photo.shopId}
                    photo={photo}
                    onSelect={onSelectShop}
                  />
                ))}
              </div>
            ))}

          {/* AIの一言（遅れてフェードイン） */}
          <div className="flex min-h-[38px] items-center gap-2 px-4 pb-2.5">
            {character && (
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-amber-200 bg-[#fff6e5]">
                <Image
                  src={character.image}
                  alt={character.name}
                  width={28}
                  height={28}
                  className={`h-full w-full object-cover ${character.imageScale}`}
                  style={{ objectPosition: character.imagePosition }}
                  draggable={false}
                />
              </div>
            )}
            {noteVisible ? (
              <p className="animate-in fade-in slide-in-from-bottom-1 text-[12px] font-medium leading-snug text-slate-700 duration-500">
                {note}
              </p>
            ) : (
              <div className="flex items-center gap-1.5 py-1" aria-label="考え中">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-1.5 w-1.5 rounded-full bg-amber-400"
                    style={{
                      animation: `dot-pulse 0.75s ease-in-out ${i * 0.18}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 追い質問バー（下部固定） */}
        <div className="shrink-0 border-t border-slate-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="このへんのことをAIに聞く…"
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!question.trim()}
              aria-label="AIに聞く"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[13px] font-bold text-white shadow-pop transition-all hover:bg-amber-600 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none"
            >
              ↑
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
