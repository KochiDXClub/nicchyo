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
 * にちよさんの絵は案内全体で1枚だけ（相談デモの中のものを除く）。左端の波線の道を
 * スクロールに合わせて降りてきて、見出しのすぐ下で一言しゃべる（IntroGrandmaRail）。
 * 節ごとに絵を置くと「何人もいる」ことになり、案内していた人がいなくなる。
 *
 * 出す条件は useMapIntro が持つ。ここは見た目と開き方だけを受け持つ。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { Shop } from '../types/shopData';
import { SHOP_CATEGORY_NAMES } from '../config/shopCategories';
import IntroMapDemo from './intro/IntroMapDemo';
import IntroSearchDemo from './intro/IntroSearchDemo';
import IntroConsultDemo from './intro/IntroConsultDemo';
import IntroGrandmaRail, {
  RAIL_STOP_HEIGHT,
  RAIL_STOP_HEIGHT_DESKTOP,
  RAIL_WIDTH,
} from './intro/IntroGrandmaRail';
import { pickIntroDemoShops, pickIntroSearchShops } from './intro/introDemoShops';

type MapIntroPanelProps = {
  /** 開いているか。閉じる動きはこの部品の中の AnimatePresence が受け持つ */
  open: boolean;
  /** マップページが既に読み込んでいる店舗。デモはここから数件借りる */
  shops?: Shop[];
  onClose: () => void;
};

/**
 * 最初に見せる高さ（画面に対する割合）。残りは地図が見えている。
 * 見出し・にちよさんの一言・説明・うながしが切れずに収まる下限で取る。
 */
const PEEK_RATIO = 0.62;
/**
 * にちよさんが次の停留点へ歩き出す基準線（画面の上からの割合）。
 *
 * ここを小さくすると、見出しが画面のほぼ上まで来るまで動き出さず、
 * 「着いてから読む」ではなく「読み終えてから来る」になる。
 * 見出しが画面に入って少し上がったころに歩き出すくらいがちょうどよい。
 */
const ACTIVATE_LINE_RATIO = 0.55;

/** これ以上スクロールしたら全画面に広げる */
const EXPAND_SCROLL_PX = 6;
/** 全画面から縮めるときに必要な下向きの引っぱり量（px） */
const COLLAPSE_PULL_PX = 48;
/** ナビゲーションバー（h-14）の分。下の操作列が隠れないようにする */
const NAV_SPACE = 'calc(3.5rem + var(--safe-bottom, 0px))';

/**
 * 画面の広さ。スマホと PC で案内の形そのものを変える。
 *
 * スマホ … 地図の上に重なるボトムシート。半分だけ開いて、スクロールで全画面
 * PC     … 中央のダイアログ。最初から開ききっている
 *
 * 引き上げて広げる・下へ払って閉じるのは指の作法で、マウスには意味がない。
 * 同じ形を両方に出すと、PC では「スマホ画面がそのまま乗っている」ように見える。
 */
function useIsDesktop(): boolean {
  // 最初の描画から正しい値で始める。false から始めると、PC でも一瞬だけ
  // ボトムシートが組まれてしまう。案内は地図が描き終わってから開くので、
  // ここが動くのは必ずブラウザの中
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
  );
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

const DESKTOP_QUERY = '(min-width: 768px)';

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

/**
 * にちよさんが立ち寄る順に並べた一言。
 *
 * 節ごとの説明はここに集約する。薄い字の説明文を別に置くと、案内している人の
 * 言葉と地の文が二重になるので、説明はにちよさんに言ってもらう。
 */
const RAIL_COMMENTS = [
  'ようこそ、日曜市へ。まずはわしが、ざっと案内するきね。',
  '通りを上や下へ動かしてみいや。気になった屋台を押したら、中が見えるき。',
  '何があるか分からんときは、ジャンルから見たらえいよ。',
  '探すより聞くほうが早いこともあるき。なんでも聞いてや。',
  'ほんなら、いってらっしゃい。ええ日曜市になるきね。',
] as const;

/**
 * デモを1つ抱えた区画。縦に積んで、上から順に読めるようにする。
 *
 * 見出しの下には、にちよさんと吹き出しが入るぶんの場所だけ空けておく。
 * 中身（絵と言葉）はレール側が1組だけ持っていて、その場所まで降りてくる。
 */
function IntroSection({
  step,
  title,
  stopRef,
  stopHeight,
  children,
}: {
  step: string;
  title: string;
  stopRef: (el: HTMLDivElement | null) => void;
  stopHeight: number;
  children: React.ReactNode;
}) {
  return (
    /* 道（絶対配置の SVG）より手前に置く。relative を付けないと、
       位置指定のない中身のほうが下に潜って、文字の上を道が横切る */
    <section className="relative z-[1] border-t border-nicchyo-ink/[0.07] py-9 md:py-11">
      <div className="pl-[var(--intro-rail)] pr-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-nicchyo-ink/35">
          {step}
        </p>
        <h3 className="mt-1.5 text-[17px] font-bold leading-tight text-nicchyo-ink md:text-[19px]">
          {title}
        </h3>
      </div>
      {/* にちよさんの停留点。高さだけ確保しておく */}
      <div ref={stopRef} className="mt-3" style={{ height: stopHeight }} />
      {/*
        画面が広くても、デモの横幅は広げすぎない。
        道を画面いっぱいに伸ばすと屋台がまばらに散って、地図に見えなくなる。
      */}
      {/*
        スマホはデモを端まで使う（地図は広いほうがよい）。
        PC は見出しと左端を揃え、横幅は広げすぎない。道を画面いっぱいに
        伸ばすと屋台がまばらに散って、地図に見えなくなる。
      */}
      <div className="mt-3 px-5 md:pl-[var(--intro-rail)] md:pr-8">
        <div className="md:max-w-[460px]">{children}</div>
      </div>
    </section>
  );
}

export default function MapIntroPanel({ open, shops, onClose }: MapIntroPanelProps) {
  const dragControls = useDragControls();
  const isDesktop = useIsDesktop();
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

  // ── にちよさんの道 ───────────────────────────────────────────
  // 停留点の位置は中身の高さで変わる（相談デモは答えが出ると伸びる）ので、
  // 一度測って終わりにせず、中身の大きさが変わるたびに測り直す
  const railAreaRef = useRef<HTMLDivElement | null>(null);
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [railHeight, setRailHeight] = useState(0);
  const [stopYs, setStopYs] = useState<number[]>([]);
  // 判定は毎回いまの値で行いたいので、state とは別に ref でも持つ
  const stopYsRef = useRef<number[]>([]);
  const [activeStop, setActiveStop] = useState(0);

  /** 同じ並びなら state を置き換えない。スクロールのたびに描き直さないため */
  const sameStops = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const measureRail = useCallback(() => {
    const area = railAreaRef.current;
    if (!area) return;
    // offsetTop は「位置指定された親からの距離」なので、節に relative を付けた
    // 時点で節の中での位置になってしまう。どこを起点に測るかを取り違えないよう、
    // 道の起点との差で測る
    const areaTop = area.getBoundingClientRect().top;
    const ys = stopRefs.current.map((el) =>
      el ? Math.round(el.getBoundingClientRect().top - areaTop) : 0
    );
    stopYsRef.current = ys;
    setRailHeight(area.offsetHeight);
    setStopYs((prev) => (sameStops(prev, ys) ? prev : ys));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measureRail();
    const area = railAreaRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureRail);
    observer.observe(area);
    return () => observer.disconnect();
  }, [measureRail, open]);

  // 閉じたら、次に開くときのために先頭へ戻しておく
  useEffect(() => {
    if (open) return;
    setActiveStop(0);
    collapse();
  }, [open, collapse]);

  /** いま読んでいるのはどの停留点か。画面の少し上を基準線にする */
  const updateActiveStop = useCallback(() => {
    const el = scrollRef.current;
    const ys = stopYsRef.current;
    if (!el || ys.length === 0) return;
    // いちばん上にいるときは必ず最初の停留点。
    // 下の基準線だけに任せると、下に書いた理由で初回に先へ飛ぶことがある
    if (el.scrollTop <= 0) {
      setActiveStop(0);
      return;
    }
    // 組み上がった直後の一瞬、この枠は親の高さが効く前で中身なりの高さになる。
    // そのまま使うと基準線が画面よりずっと下に引かれ、開いた時点で
    // にちよさんが2つ目の停留点に立ってしまうので、画面の高さで頭を押さえる
    // いちばん下まで来たら必ず最後の停留点。締めの節は下端に近く、
    // 基準線まで上がりきらないことがある
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
      setActiveStop(ys.length - 1);
      return;
    }
    const view = viewportHeight > 0 ? Math.min(el.clientHeight, viewportHeight) : el.clientHeight;
    const line = el.scrollTop + view * ACTIVATE_LINE_RATIO;
    let next = 0;
    for (let i = 0; i < ys.length; i += 1) {
      if (ys[i] <= line) next = i;
    }
    setActiveStop(next);
  }, [scrollRef, viewportHeight]);

  // 停留点の位置・画面の高さ・開き具合が変わったら測り直す。
  // どれも組み上がりの途中で動くので、一度だけでは正しい答えにならない
  useEffect(() => {
    updateActiveStop();
  }, [updateActiveStop, stopYs, expanded]);

  // 測り直しは描画の直前に1回だけ。scroll はフレームに何度も来るので、
  // そのたびにレイアウトを読むと動かしている最中がもたつく
  const measureFrameRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    // PC は最初から開ききっているので、広げる判定は回さない
    if (!isDesktop) handlers.onScroll();
    if (measureFrameRef.current !== null) return;
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null;
      // 停留点の位置は、写真の読み込みや字体の差し替わりで後からずれる。
      // 一度測って終わりにすると、にちよさんが見出しに重なって立つ。
      // 読むだけなので、動かしている間に取り直して常にいまの位置に合わせる
      measureRail();
      updateActiveStop();
    });
  }, [handlers, isDesktop, measureRail, updateActiveStop]);
  useEffect(
    () => () => {
      if (measureFrameRef.current !== null) window.cancelAnimationFrame(measureFrameRef.current);
    },
    []
  );

  const stopHeight = isDesktop ? RAIL_STOP_HEIGHT_DESKTOP : RAIL_STOP_HEIGHT;
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

  // 案内の中身。器（スマホ＝ボトムシート / PC＝中央のダイアログ）は別でも、
  // 読むものと触るものは同じ1組を使う
  const content = (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 top-4 z-20 rounded-full bg-nicchyo-base/80 p-1.5 text-nicchyo-ink/40 backdrop-blur-sm transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary"
      >
        <X className="h-4 w-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        {...(isDesktop ? {} : handlers)}
        onScroll={handleScroll}
      >
        {/* にちよさんの道が通る範囲。停留点の位置はここの先頭から測る */}
        <div
          ref={railAreaRef}
          className="relative"
          style={{ ['--intro-rail' as string]: `${RAIL_WIDTH}px` }}
        >
          <IntroGrandmaRail
            height={railHeight}
            stopYs={stopYs}
            targetStop={activeStop}
            comments={RAIL_COMMENTS}
            stopHeight={stopHeight}
          />

          {/* ── 見出し ── */}
          <div className="relative z-[1] pl-[var(--intro-rail)] pr-5 pt-3 md:pr-8 md:pt-4">
            <h2
              id="map-intro-title"
              className="text-[19px] font-bold leading-tight text-nicchyo-ink md:text-[24px]"
            >
              ようこそ、日曜市へ
            </h2>
            <p className="mt-0.5 text-[12px] font-semibold tracking-wide text-nicchyo-ink/45">
              nicchyo（ニッチョ）
            </p>
          </div>

          {/* にちよさんの最初の停留点 */}
          <div
            ref={(el) => {
              stopRefs.current[0] = el;
            }}
            className="mt-3"
            style={{ height: stopHeight }}
          />

          <div className="relative z-[1] pl-[var(--intro-rail)] pr-5 md:pr-8">
            <p className="text-[13.5px] leading-[1.9] text-nicchyo-ink/75 md:text-[15px]">
              毎週日曜、高知城のふもとから追手筋にかけて約300の店が並びます。
              この地図は、はじめての人がそこを歩くためのものです。
            </p>

            <div className="pb-8" />
          </div>

          {/* ── 機能ごとのデモ ── */}
          <IntroSection
            step="01"
            title="地図で店を探す"
            stopRef={(el) => {
              stopRefs.current[1] = el;
            }}
            stopHeight={stopHeight}
          >
            <IntroMapDemo shops={mapDemoShops} frameHeight={isDesktop ? 500 : undefined} />
          </IntroSection>

          <IntroSection
            step="02"
            title="ジャンルでしぼる"
            stopRef={(el) => {
              stopRefs.current[2] = el;
            }}
            stopHeight={stopHeight}
          >
            <IntroSearchDemo
              shops={searchDemoShops}
              categories={searchCategories}
              frameHeight={isDesktop ? 380 : undefined}
            />
          </IntroSection>

          <IntroSection
            step="03"
            title="にちよさんに聞く"
            stopRef={(el) => {
              stopRefs.current[3] = el;
            }}
            stopHeight={stopHeight}
          >
            <IntroConsultDemo />
          </IntroSection>

          {/* ── 締め。にちよさんの最後の停留点 ── */}
          <section className="relative z-[1] border-t border-nicchyo-ink/[0.07] py-9 md:py-11">
            <div className="pl-[var(--intro-rail)] pr-5 md:pr-8">
              <h3 className="text-[17px] font-bold leading-tight text-nicchyo-ink md:text-[19px]">
                日曜市を楽しんで！
              </h3>
            </div>
            <div
              ref={(el) => {
                stopRefs.current[4] = el;
              }}
              className="mt-3"
              style={{ height: stopHeight }}
            />
            <div className="mt-3 pl-[var(--intro-rail)] pr-5 md:pr-8">
              <p className="text-[12.5px] leading-[1.9] text-nicchyo-ink/55 md:text-[13.5px]">
                迷っても大丈夫です。真ん中の通路をまっすぐ行けば、いつかは端に着きます。
              </p>
              <Link
                href="/about"
                className="mt-5 inline-block text-[12.5px] font-semibold text-nicchyo-ink/45 underline-offset-4 hover:underline"
              >
                nicchyo について詳しく
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* いつでも地図へ戻れるようにする操作列 */}
      <div
        className="shrink-0 border-t border-nicchyo-ink/[0.07] bg-nicchyo-base/95 px-5 pt-3 backdrop-blur-sm md:px-8 md:py-4"
        style={isDesktop ? undefined : { paddingBottom: `calc(${NAV_SPACE} + 0.75rem)` }}
      >
        <button
          type="button"
          onClick={onClose}
          className="mx-auto block w-full rounded-2xl bg-nicchyo-primary py-3.5 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(126,217,87,0.9)] transition active:scale-[0.98] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2 md:w-[260px]"
        >
          地図をみる
        </button>
      </div>
    </>
  );

  /*
   * 器（スマホ＝ボトムシート / PC＝中央のダイアログ）は AnimatePresence の直下に、
   * それぞれ別の key を持つ1つの要素として置く。
   *
   * こうしておく理由が2つある。
   * - 同じ要素を使い回すと、スマホ用が framer で書き込んだインラインの height や
   *   角丸が残り、幅が 768px を跨いで変わったときにダイアログが中身の高さまで伸びて、
   *   途中の節だけが画面に見えるスクロールできない状態になる
   * - かといって、生きている AnimatePresence の子の中で motion 要素を丸ごと
   *   付け替えると、その後の退場が終わったと見なされず、透明な層が画面に残る
   * 直下の key を替えるのは AnimatePresence が本来扱う形なので、どちらも起きない。
   */
  return (
    <AnimatePresence>
      {open && isDesktop && (
        <motion.div
          key="map-intro-pc"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9989]"
        >
          {/* 暗幕。地図は薄く見えたままにして、どこに戻るのかを残す */}
          <button
            type="button"
            onClick={onClose}
            aria-label="案内を閉じて地図を見る"
            className="absolute inset-0 cursor-default bg-nicchyo-ink/35 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: 16, scale: 0.985 }}
            animate={{ y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-intro-title"
            className="absolute inset-0 m-auto flex h-[88vh] w-[min(620px,94vw)] flex-col overflow-hidden rounded-[28px] bg-nicchyo-base pt-6 shadow-[0_32px_80px_-24px_rgba(58,58,58,0.55)] ring-1 ring-nicchyo-ink/[0.08]"
          >
            {content}
          </motion.div>
        </motion.div>
      )}

      {open && !isDesktop && (
        <motion.div
          key="map-intro-sp"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-[9988]"
        >
          {/* 上に見えている地図。暗幕は敷かず、タップで閉じられるようにする */}
          <button
            type="button"
            onClick={onClose}
            aria-label="案内を閉じて地図を見る"
            aria-hidden={expanded}
            className={`absolute inset-0 cursor-default bg-transparent ${
              expanded ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          />
          <motion.div
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
            className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07]"
          >
            {/* ドラッグハンドル。全画面のときは元の高さへ、そうでなければ閉じる */}
            <div
              className="flex h-7 w-full shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
            >
              <div className="h-1 w-10 rounded-full bg-nicchyo-ink/15" />
            </div>
            {content}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
