"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";

// モバイル（375px基準）でチップ3件が収まり、残りは折りたたむUX判断
const GENRE_PREVIEW_COUNT = 3;

export function GenreFilter({
  categories,
  selected,
  onSelect,
  favoritesActive,
  favoriteCount,
  onToggleFavorites,
}: {
  categories: readonly string[];
  selected: string | null;
  onSelect: (cat: string) => void;
  /** お気に入りだけに絞り込んでいるか */
  favoritesActive: boolean;
  /** 0件のときはチップ自体を出さない（初来訪者の画面を増やさないため） */
  favoriteCount: number;
  onToggleFavorites: () => void;
}) {
  const isSelectedHidden = selected !== null && categories.indexOf(selected) >= GENRE_PREVIEW_COUNT;
  const [expanded, setExpanded] = useState(isSelectedHidden);

  useEffect(() => {
    if (isSelectedHidden) setExpanded(true);
  }, [isSelectedHidden]);

  const previewCategories = categories.slice(0, GENRE_PREVIEW_COUNT);
  const hiddenCategories = categories.slice(GENRE_PREVIEW_COUNT);

  function chipClass(cat: string) {
    return `shrink-0 whitespace-nowrap rounded-chip border px-[13px] py-[7px] text-[13px] font-bold shadow-chip transition-all duration-[120ms] ${
      selected === cat
        ? 'border-amber-600 bg-amber-500 text-white'
        : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50 active:bg-amber-50'
    }`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {favoriteCount > 0 && (
        <motion.button
          type="button"
          onClick={onToggleFavorites}
          aria-pressed={favoritesActive}
          className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip border px-[13px] py-[7px] text-[13px] font-bold shadow-chip transition-all duration-[120ms] ${
            favoritesActive
              ? 'border-favorite-fg bg-favorite-fg text-white'
              : 'border-favorite-line bg-white text-favorite-fg hover:bg-favorite-bg active:bg-favorite-bg'
          }`}
          whileTap={{ scale: 0.88 }}
        >
          <Heart
            className="h-3.5 w-3.5"
            fill={favoritesActive ? 'currentColor' : 'none'}
            aria-hidden
          />
          お気に入り
          <span
            className={`rounded-full px-1.5 text-[11px] font-bold ${
              favoritesActive ? 'bg-white/25 text-white' : 'bg-favorite-bg text-favorite-fg'
            }`}
          >
            {favoriteCount}
          </span>
        </motion.button>
      )}
      {previewCategories.map((cat) => (
        <motion.button key={cat} type="button" onClick={() => onSelect(cat)} className={chipClass(cat)} whileTap={{ scale: 0.88 }}>
          {cat}
        </motion.button>
      ))}

      {/* 展開中の追加チップ（アニメ付き） */}
      <AnimatePresence initial={false}>
        {expanded && hiddenCategories.map((cat, i) => (
          <motion.button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={chipClass(cat)}
            initial={{ opacity: 0, scale: 0.82, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.82, y: -4 }}
            transition={{ duration: 0.18, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            {cat}
          </motion.button>
        ))}
      </AnimatePresence>

      {/* ＋ / × トグルボタン（チップと同列・オレンジ） */}
      <motion.button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'ジャンルを閉じる' : 'ジャンルをもっと見る'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md active:scale-90"
        animate={{ rotate: expanded ? 45 : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        whileTap={{ scale: 0.88 }}
      >
        <svg width="13" height="13" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </motion.button>
    </div>
  );
}
