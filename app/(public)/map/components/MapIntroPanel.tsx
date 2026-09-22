'use client';

/**
 * MapIntroPanel
 *
 * 初来訪者に「ここが何のサービスか」を伝える案内パネル。
 *
 * 独立した LP ページではなく、読み込み終わったマップの上に下から重ねる。
 * 最初は画面の半分ほどで開き、上に地図が見えたままにする。そこから下へ
 * スクロールすると全画面へなめらかに広がり、機能ごとのデモが縦に並ぶ。
 * 「説明を読まされてからマップへ行く」ではなく「マップに来ていて、その上で
 * 使い方を触っている」にするための形。
 *
 * デモは絵ではなく、本物の部品（markerHtmlGenerator・ShopBannerHero・道の色）で
 * 組んである。屋台をタップすればバナーが出るし、ハートを押せば屋根に札が付く。
 *
 * 出す条件は useMapIntro が持つ。ここは見た目と開き方だけを受け持つ。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import NextImage from 'next/image';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import type { Shop } from '../types/shopData';
import { SHOP_CATEGORY_NAMES } from '../config/shopCategories';
import IntroMapDemo from './intro/IntroMapDemo';
import IntroSearchDemo from './intro/IntroSearchDemo';
import IntroConsultDemo from './intro/IntroConsultDemo';
import { pickIntroDemoShops, pickIntroSearchShops } from './intro/introDemoShops';

type MapIntroPanelProps = {
  /** マップページが既に読み込んでいる店舗。デモはここから数件借りる */
  shops?: Shop[];
  onClose: () => void;
};

/** 最初に見せる高さ（画面に対する割合）。残りは地図が見えている */
const PEEK_RATIO = 0.46;
/** これ以上スクロールしたら全画面に広げる */
const EXPAND_SCROLL_PX = 6;
/** 全画面から縮めるときに必要な下向きの引っぱり量（px） */
const COLLAPSE_PULL_PX = 48;
/** ナビゲーションバー（h-14）の分。下の操作列が隠れないようにする */
const NAV_SPACE = 'calc(3.5rem + var(--safe-bottom, 0px))';

/** 画面の高さ。アドレスバーの出入りやスマホの回転に追従する */
function useViewportHeight(): number {
  const [height, setHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerHeight
  );
  useEffect(() => {
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

/**
 * 下へスクロールしたら全画面、いちばん上でさらに下へ引っぱったら元の高さに戻す。
 *
 * 引っぱりは scroll イベントでは取れない（いちばん上では scrollTop が動かない）ので、
 * ホイールと指の移動量を直接見る。
 */
function useSheetExpansion(): {
  expanded: boolean;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  handlers: {
    onScroll: () => void;
    onWheel: (event: React.WheelEvent) => void;
    onTouchStart: (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
  };
  collapse: () => void;
} {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const collapse = useCallback(() => {
    setExpanded(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop > EXPAND_SCROLL_PX) setExpanded(true);
  }, []);

  const atTop = () => (scrollRef.current?.scrollTop ?? 0) <= 0;

  const onWheel = useCallback((event: React.WheelEvent) => {
    if (event.deltaY > 0) {
      setExpanded(true);
      return;
    }
    if (event.deltaY < 0 && atTop()) collapse();
  }, [collapse]);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (startY === null || currentY === undefined) return;
    const delta = currentY - startY;
    // 指を上へ（= 下へスクロール）動かしたら広げる
    if (delta < -4) {
      setExpanded(true);
      return;
    }
    // いちばん上で下へ引っぱったら縮める
    if (delta > COLLAPSE_PULL_PX && atTop()) collapse();
  }, [collapse]);

  return {
    expanded,
    scrollRef,
    handlers: { onScroll, onWheel, onTouchStart, onTouchMove },
    collapse,
  };
}

/** デモを1つ抱えた区画。縦に積んで、上から順に読めるようにする */
function IntroSection({
  step,
  title,
  lead,
  children,
}: {
  step: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-nicchyo-ink/[0.07] px-5 py-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-nicchyo-ink/35">
        {step}
      </p>
      <h3 className="mt-1 text-[17px] font-bold leading-tight text-nicchyo-ink">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-nicchyo-ink/65">{lead}</p>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export default function MapIntroPanel({ shops, onClose }: MapIntroPanelProps) {
  const dragControls = useDragControls();
  const viewportHeight = useViewportHeight();
  const { expanded, scrollRef, handlers, collapse } = useSheetExpansion();

  const mapDemoShops = useMemo(() => pickIntroDemoShops(shops), [shops]);
  const searchCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const shop of shops ?? []) {
      const key = shop.category || '';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const usable = SHOP_CATEGORY_NAMES.filter((name) => (counts.get(name) ?? 0) >= 2);
    // 店舗が読めていないときは、控えのデモ店舗が持つカテゴリで見せる
    return (usable.length >= 3 ? usable : SHOP_CATEGORY_NAMES).slice(0, 3);
  }, [shops]);
  const searchDemoShops = useMemo(
    () => pickIntroSearchShops(shops, searchCategories),
    [shops, searchCategories]
  );

  const peekHeight = Math.round(viewportHeight * PEEK_RATIO);
  const sheetHeight = expanded ? viewportHeight : peekHeight;

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      const pulledDown = info.offset.y > 80 || info.velocity.y > 500;
      if (!pulledDown) return;
      // 全画面のときは、まず元の高さへ。もう一度引いたら閉じる
      if (expanded) collapse();
      else onClose();
    },
    [collapse, expanded, onClose]
  );

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
        aria-hidden={expanded}
        className={`fixed inset-0 z-[9988] cursor-default bg-transparent ${
          expanded ? 'pointer-events-none' : ''
        }`}
      />

      <motion.div
        key="map-intro-panel"
        initial={{ y: '100%' }}
        animate={{
          y: 0,
          height: sheetHeight,
          borderTopLeftRadius: expanded ? 0 : 28,
          borderTopRightRadius: expanded ? 0 : 28,
        }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.3 }}
        onDragEnd={handleDragEnd}
        role="dialog"
        aria-modal="false"
        aria-labelledby="map-intro-title"
        className="fixed inset-x-0 bottom-0 z-[9990] mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07]"
      >
        {/* ドラッグハンドル。全画面のときは元の高さへ、そうでなければ閉じる */}
        <div
          className="flex h-7 w-full shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
        >
          <div className="h-1 w-10 rounded-full bg-nicchyo-ink/15" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-4 top-4 z-10 rounded-full bg-nicchyo-base/80 p-1.5 text-nicchyo-ink/40 backdrop-blur-sm transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          {...handlers}
        >
          {/* ── 見出し ── */}
          <div className="px-5 pt-1">
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
                <h2
                  id="map-intro-title"
                  className="text-[19px] font-bold leading-tight text-nicchyo-ink"
                >
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

            {/* 広げる前だけ出すうながし。スクロールすれば全画面になる */}
            <div
              className={`mt-4 flex items-center justify-center gap-1.5 pb-5 text-[12px] font-semibold text-nicchyo-ink/40 transition-opacity duration-200 ${
                expanded ? 'pointer-events-none opacity-0' : 'opacity-100'
              }`}
            >
              <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden />
              下にスクロールすると、ここで実際に試せます
            </div>
          </div>

          {/* ── 機能ごとのデモ ── */}
          <IntroSection
            step="01"
            title="地図で店を探す"
            lead="指で通りをたどると、写真と店名が前に出ます。気になった店をタップすると、品物も営業時間も見られます。"
          >
            <IntroMapDemo shops={mapDemoShops} />
          </IntroSection>

          <IntroSection
            step="02"
            title="ジャンルでしぼる"
            lead="「何があるか分からない」ときは、ジャンルから。当てはまった店が写真で前に出ます。"
          >
            <IntroSearchDemo shops={searchDemoShops} categories={searchCategories} />
          </IntroSection>

          <IntroSection
            step="03"
            title="にちよさんに聞く"
            lead="探すより聞くほうが早いこともあります。土佐弁のAIガイドが案内します。"
          >
            <IntroConsultDemo />
          </IntroSection>

          <div className="border-t border-nicchyo-ink/[0.07] px-5 py-7 text-center">
            <p className="text-[14px] font-bold leading-relaxed text-nicchyo-ink">
              あとは、歩くだけ。
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-nicchyo-ink/55">
              迷っても大丈夫です。真ん中の通路をまっすぐ行けば、いつかは端に着きます。
            </p>
            <Link
              href="/about"
              className="mt-4 inline-block text-[12.5px] font-semibold text-nicchyo-ink/45 underline-offset-4 hover:underline"
            >
              nicchyo について詳しく
            </Link>
          </div>

        </div>

        {/* いつでも地図へ戻れるようにする操作列。
            下のデモに半端に重ならないよう、帯として置いて内容はその手前で止める */}
        <div
          className="shrink-0 border-t border-nicchyo-ink/[0.07] bg-nicchyo-base/95 px-5 pt-3 backdrop-blur-sm"
          style={{ paddingBottom: `calc(${NAV_SPACE} + 0.75rem)` }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-nicchyo-primary py-3.5 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(126,217,87,0.9)] transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2"
          >
            地図をみる
          </button>
        </div>
      </motion.div>
    </>
  );
}
