'use client';

/**
 * MapIntroPanel
 *
 * 初来訪者に「ここが何のサービスか」を伝える案内パネル。
 *
 * 独立した LP ページではなく、読み込み終わったマップの上に下から重ねる。
 * 最初は画面の6割ほどで開き、上に地図が見えたままにする。シートは指に付いてきて、
 * 離した速さと位置で「半開き」か「全画面」の段に吸い付く（useIntroSheetGestures）。
 * 全画面では機能ごとのデモが縦に並ぶ。
 * 「説明を読まされてからマップへ行く」ではなく「マップに来ていて、その上で
 * 使い方を触っている」にするための形。
 *
 * 節の先頭で必ず一度止まる（scroll-snap）ので、勢いよく送っても見どころを
 * 飛ばさない。下の操作列には進み具合の点があり、押せばその節へ飛べる。
 *
 * デモは絵ではなく、本物の部品（markerHtmlGenerator・ShopBannerHero・道の色）で
 * 組んである。屋台をタップすればバナーが出るし、ハートを押せば屋根に札が付く。
 * バナーはデモの枠の中ではなく、案内全体の上に本番と同じ大きさで開く。
 * お気に入りは案内全体で1つの束なので、地図デモで付けた印はジャンルデモでも付いている。
 *
 * にちよさんの絵は案内全体で1枚だけ（相談デモの中のものを除く）。左端の波線の道を
 * スクロールと一緒に降りてきて、見出しのすぐ下の停留点で止まったときだけ一言しゃべる
 * （IntroGrandmaRail）。
 * 節ごとに絵を置くと「何人もいる」ことになり、案内していた人がいなくなる。
 *
 * 出す条件は useMapIntro が持つ。ここは見た目と開き方だけを受け持つ。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { siteText, siteTextWithEmphasis } from '@/lib/siteCopy';
import { ArrowUpRight, X } from 'lucide-react';
import type { Shop } from '../types/shopData';
import type { Landmark } from '../types/landmark';
import type { MapRoute } from '../types/mapRoute';
import type { MapSpot } from '@/lib/spots';
import SpotCard from './SpotCard';
import { SHOP_CATEGORY_NAMES } from '../config/shopCategories';
import IntroMapDemo from './intro/IntroMapDemo';
import IntroSearchDemo from './intro/IntroSearchDemo';
import IntroConsultDemo from './intro/IntroConsultDemo';
import IntroOdekakeDemo from './intro/IntroOdekakeDemo';
import { useIntroOdekakeGuide } from './intro/useIntroOdekakeGuide';
import IntroShopSheet from './intro/IntroShopSheet';
import IntroGrandmaRail, {
  RAIL_STOP_HEIGHT,
  RAIL_STOP_HEIGHT_DESKTOP,
  RAIL_WIDTH,
} from './intro/IntroGrandmaRail';
import {
  pickIntroDemoShops,
  pickIntroSearchShops,
  type IntroDemoShop,
} from './intro/introDemoShops';
import { useIsDesktop, useViewportHeight } from './intro/useIntroViewport';
import { useIntroSheetGestures } from './intro/useIntroSheetGestures';
import IntroProgress from './intro/IntroProgress';
import IntroSection from './intro/IntroSection';

type MapIntroPanelProps = {
  /** 開いているか。閉じる動きはこの部品の中の AnimatePresence が受け持つ */
  open: boolean;
  /** マップページが既に読み込んでいる店舗。デモはここから数件借りる */
  shops?: Shop[];
  /** マップページが既に読み込んでいるランドマーク。おでかけサポートのデモはここからお手洗いを借りる */
  landmarks?: Landmark[];
  /** 会場の道。おでかけサポートのデモの道すじと地図に使う */
  mapRoute: MapRoute;
  /**
   * おでかけサポートの節を出すか。
   * 本番でおでかけサポートの入口を隠しているとき（公開設定が限定公開・非公開）は、
   * 案内でも触れない。使えないものを紹介すると、地図に戻って探すことになる
   */
  showOdekake?: boolean;
  onClose: () => void;
};

/**
 * 最初に見せる高さ（画面に対する割合）。残りは地図が見えている。
 * 見出し・にちよさんの一言・数字・説明に加えて、次の節の見出しが
 * 下端にのぞく高さで取る。次があると分かるところまで見せておく。
 */
const PEEK_RATIO = 0.67;
/**
 * にちよさんが次の停留点へ歩き出す基準線（画面の上からの割合）。
 *
 * ここを小さくすると、見出しが画面のほぼ上まで来るまで動き出さず、
 * 「着いてから読む」ではなく「読み終えてから来る」になる。
 * 見出しが画面に入って少し上がったころに歩き出すくらいがちょうどよい。
 */
const ACTIVATE_LINE_RATIO = 0.55;

/** ナビゲーションバー（h-14）の分。下の操作列が隠れないようにする */
const NAV_SPACE = 'calc(3.5rem + var(--safe-bottom, 0px))';


type IntroStopKey = 'welcome' | 'map' | 'search' | 'consult' | 'odekake' | 'end';

/**
 * にちよさんが立ち寄る順に並べた停留点。名前は進み具合の点の読み上げに、
 * 一言は停留点に着いたときの吹き出しに使う。
 *
 * 節ごとの説明はここに集約する。薄い字の説明文を別に置くと、案内している人の
 * 言葉と地の文が二重になるので、説明はにちよさんに言ってもらう。
 */
const INTRO_STOPS: ReadonlyArray<{ key: IntroStopKey; label: string; comment: string }> = (
  ['welcome', 'map', 'search', 'consult', 'odekake', 'end'] as const
).map((key) => ({
  key,
  // 名前と一言はスプレッドシートで編集する（docs/SITE_COPY.md）
  label: siteText(`mapIntro.${key}.label`),
  comment: siteText(`mapIntro.${key}.comment`),
}));


type OpenShop = { shop: IntroDemoShop; source: 'map' | 'search' };

export default function MapIntroPanel({
  open,
  shops,
  landmarks,
  mapRoute,
  showOdekake = true,
  onClose,
}: MapIntroPanelProps) {
  const isDesktop = useIsDesktop();
  const viewportHeight = useViewportHeight();
  const reduceMotion = useReducedMotion() ?? false;
  const peekHeight = Math.round(viewportHeight * PEEK_RATIO);
  const {
    expanded,
    sheetRef,
    scrollRef,
    height: sheetHeight,
    pull: sheetPull,
    radius: sheetRadius,
    onScroll: onSheetScroll,
    onWheel: onSheetWheel,
    expand,
    collapse,
    toggle: toggleSheet,
    scrub,
  } = useIntroSheetGestures({ peekHeight, fullHeight: viewportHeight, onClose, reduceMotion });

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

  // ── 停留点の並び ─────────────────────────────────────────────
  // おでかけサポートを隠しているときはその節ごと抜く。番号・点・一言もそれに合わせる
  const stops = useMemo(
    () => INTRO_STOPS.filter((stop) => showOdekake || stop.key !== 'odekake'),
    [showOdekake]
  );
  const stopLabels = useMemo(() => stops.map((stop) => stop.label), [stops]);
  const stopComments = useMemo(() => stops.map((stop) => stop.comment), [stops]);
  const stopIndex = useCallback(
    (key: IntroStopKey) => stops.findIndex((stop) => stop.key === key),
    [stops]
  );

  // ── おでかけサポートのデモ ───────────────────────────────────
  // 経路と案内先はフックが持つ。印を押したときのスポットカードは、店のバナーと同じく
  // デモの枠の中ではなく案内全体の上に開くので、開いているスポットはここで持つ
  const odekake = useIntroOdekakeGuide({ landmarks, mapRoute });
  const [openSpot, setOpenSpot] = useState<MapSpot | null>(null);

  // ── デモで開いた店とお気に入り ─────────────────────────────
  // バナーはデモの枠の中ではなく案内全体の上に開くので、どのデモから開いたかを
  // ここで持つ。お気に入りも案内全体で1つの束にして、両方のデモで同じ印が付く
  const [openShop, setOpenShop] = useState<OpenShop | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const openShopFrom = useCallback(
    (source: OpenShop['source']) => (shop: IntroDemoShop) => {
      setOpenShop({ shop, source });
      // 半開きのままだとバナーの置き場が狭いので、開くと同時に全画面へ
      if (!isDesktop) expand();
    },
    [expand, isDesktop]
  );
  const closeShop = useCallback(() => setOpenShop(null), []);
  const toggleFavorite = useCallback((id: number) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const openSpotCard = useCallback(
    (spot: MapSpot) => {
      setOpenSpot(spot);
      if (!isDesktop) expand();
    },
    [expand, isDesktop]
  );
  const closeSpotCard = useCallback(() => setOpenSpot(null), []);
  /** スポットカードの「ここへ案内」。本番と同じく、案内先が切り替わってカードは閉じる */
  const navigateOdekake = odekake.navigateTo;
  const navigateFromSpotCard = useCallback(
    (spot: MapSpot) => {
      navigateOdekake(spot);
      setOpenSpot(null);
    },
    [navigateOdekake]
  );

  // ── にちよさんの道 ───────────────────────────────────────────
  // 停留点の位置は中身の高さで変わる（相談デモは答えが出ると伸びる）ので、
  // 一度測って終わりにせず、中身の大きさが変わるたびに測り直す
  const railAreaRef = useRef<HTMLDivElement | null>(null);
  const stopRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [railHeight, setRailHeight] = useState(0);
  const [stopYs, setStopYs] = useState<number[]>([]);
  /** 各停留点にぴったり立つスクロール位置（節の先頭）。にちよさんがスクロールと一緒に動く物差し */
  const [anchorYs, setAnchorYs] = useState<number[]>([]);
  // 判定は毎回いまの値で行いたいので、state とは別に ref でも持つ
  const stopYsRef = useRef<number[]>([]);
  const [activeStop, setActiveStop] = useState(0);
  /**
   * スクロール枠の高さ。締めの節をこの高さにして、最後の1枚が先頭で揃うようにする。
   * にちよさんが画面の外から歩き始めるときの「外」の判定にも使う
   */
  const [scrollerHeight, setScrollerHeight] = useState(0);
  /** いまのスクロール位置。描き直さずに読めるよう motion value で持つ */
  const scrollY = useMotionValue(0);

  /** 同じ並びなら state を置き換えない。スクロールのたびに描き直さないため */
  const sameStops = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const stopCount = stops.length;
  const measureRail = useCallback(() => {
    const area = railAreaRef.current;
    if (!area) return;
    // offsetTop は「位置指定された親からの距離」なので、節に relative を付けた
    // 時点で節の中での位置になってしまう。どこを起点に測るかを取り違えないよう、
    // 道の起点との差で測る
    const areaTop = area.getBoundingClientRect().top;
    const ys = stopRefs.current
      .slice(0, stopCount)
      .map((el) => (el ? Math.round(el.getBoundingClientRect().top - areaTop) : 0));
    stopYsRef.current = ys;
    setRailHeight(area.offsetHeight);
    setStopYs((prev) => (sameStops(prev, ys) ? prev : ys));
    const scroller = scrollRef.current;
    // 節の先頭（scroll-snap で止まる位置）。最後の節は下端までしか送れないので、そこで頭を押さえる
    const maxScroll = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : Infinity;
    const anchors = Array.from(area.querySelectorAll<HTMLElement>('[data-intro-stop]')).map((el) =>
      Math.min(maxScroll, Math.round(el.getBoundingClientRect().top - areaTop))
    );
    setAnchorYs((prev) => (sameStops(prev, anchors) ? prev : anchors));
    if (scroller) {
      // 組み上がった直後の一瞬、この枠は親の高さが効く前で中身なりの高さになる。
      // その値をそのまま使うと締めの節が何画面ぶんにも伸びるので、画面の高さで頭を押さえる
      const height = Math.min(
        scroller.clientHeight,
        window.innerHeight > 0 ? window.innerHeight : scroller.clientHeight
      );
      setScrollerHeight((prev) => (prev === height ? prev : height));
    }
  }, [scrollRef, stopCount]);

  useLayoutEffect(() => {
    if (!open) return;
    measureRail();
    const area = railAreaRef.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureRail);
    observer.observe(area);
    const scroller = scrollRef.current;
    if (scroller) observer.observe(scroller);
    return () => observer.disconnect();
  }, [measureRail, open, scrollRef]);

  // 閉じたら、次に開くときのために先頭へ戻しておく
  const resetOdekake = odekake.reset;
  useEffect(() => {
    if (open) return;
    setActiveStop(0);
    setOpenShop(null);
    setOpenSpot(null);
    resetOdekake();
    scrollY.set(0);
    collapse();
  }, [open, collapse, resetOdekake, scrollY]);

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
    // いちばん下まで来たら必ず最後の停留点。締めの節は下端に近く、
    // 基準線まで上がりきらないことがある
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
      setActiveStop(ys.length - 1);
      return;
    }
    // 組み上がった直後の一瞬、この枠は親の高さが効く前で中身なりの高さになる。
    // そのまま使うと基準線が画面よりずっと下に引かれ、開いた時点で
    // にちよさんが2つ目の停留点に立ってしまうので、画面の高さで頭を押さえる
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
    if (!isDesktop) onSheetScroll();
    if (scrollRef.current) scrollY.set(scrollRef.current.scrollTop);
    if (measureFrameRef.current !== null) return;
    measureFrameRef.current = window.requestAnimationFrame(() => {
      measureFrameRef.current = null;
      // 停留点の位置は、写真の読み込みや字体の差し替わりで後からずれる。
      // 一度測って終わりにすると、にちよさんが見出しに重なって立つ。
      // 読むだけなので、動かしている間に取り直して常にいまの位置に合わせる
      measureRail();
      updateActiveStop();
    });
  }, [isDesktop, measureRail, onSheetScroll, scrollRef, scrollY, updateActiveStop]);
  useEffect(
    () => () => {
      if (measureFrameRef.current !== null) window.cancelAnimationFrame(measureFrameRef.current);
    },
    []
  );

  /** 進み具合の点から、その節の先頭へ */
  const scrollToStop = useCallback(
    (index: number) => {
      const scroller = scrollRef.current;
      const area = railAreaRef.current;
      if (!scroller || !area) return;
      const target = area.querySelector<HTMLElement>(`[data-intro-stop="${index}"]`);
      if (!target) return;
      const top = target.getBoundingClientRect().top - area.getBoundingClientRect().top;
      if (!isDesktop && index > 0) expand();
      scroller.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    },
    [expand, isDesktop, reduceMotion, scrollRef]
  );

  const stopHeight = isDesktop ? RAIL_STOP_HEIGHT_DESKTOP : RAIL_STOP_HEIGHT;

  // 案内の中身。器（スマホ＝ボトムシート / PC＝中央のダイアログ）は別でも、
  // 読むものと触るものは同じ1組を使う
  const content = (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-2 top-2 z-20 flex h-11 w-11 items-center justify-center rounded-full text-nicchyo-ink/45 transition hover:bg-nicchyo-ink/5 hover:text-nicchyo-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary md:right-3 md:top-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nicchyo-base/80 backdrop-blur-sm">
          <X className="h-4 w-4" />
        </span>
      </button>

      {/*
        節の先頭で必ず一度止まる（scroll-snap）。
        勢いよく送っても次の見出しが画面の上に来たところで止まり、
        そこからもう一度送ると次へ進む。節を飛ばして下まで流れないので、
        どの見どころも先頭から目に入る。
        止まる位置はブラウザが決めるので、止まった先で位置がずれることもない
      */}
      <div
        ref={scrollRef}
        className="flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain"
        onWheel={isDesktop ? undefined : onSheetWheel}
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
            anchorYs={anchorYs}
            scrollY={scrollY}
            comments={stopComments}
            stopHeight={stopHeight}
            scrollerRef={scrollRef}
            onScrubStart={scrub.start}
            onScrub={scrub.to}
            onScrubEnd={scrub.end}
          />

          {/* ── 見出し ──
              いちばん上も止まる位置にしておく。ここが止まる位置でないと、
              一度下へ送ったあと先頭へ戻れなくなる（戻る先が無い）。
              右上に差す黄色は、地図の上に「はじまり」があることの合図 */}
          <div
            data-intro-stop={0}
            className="snap-start snap-always bg-[radial-gradient(120%_70%_at_100%_0%,rgba(255,222,89,0.32),transparent_60%)]"
          >
            <div className="relative z-[1] pl-[var(--intro-rail)] pr-12 pt-4 md:pr-16 md:pt-5">
              <span className="inline-flex items-center rounded-full bg-nicchyo-accent/70 px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-nicchyo-ink/80">
                {siteText('mapIntro.badge')}
              </span>
              <h2
                id="map-intro-title"
                className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-tight text-nicchyo-ink md:text-[32px]"
              >
                {siteText('mapIntro.title')}
              </h2>
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
              {/* 日曜市の大きさは文章のまま、数字だけ少し立てる。札や枠に切り出さない */}
              <p className="text-[15px] leading-[1.9] text-nicchyo-ink/75 md:text-[16px]">
                {siteTextWithEmphasis('mapIntro.lead', 'font-bold text-nicchyo-ink')}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[1.85] text-nicchyo-ink/55 md:text-[14px]">
                {siteText('mapIntro.sub')}
              </p>

              <div className="pb-4" />
            </div>
          </div>

          {/* ── 機能ごとのデモ ── */}
          <IntroSection
            index={stopIndex('map')}
            step="01"
            title={stopLabels[stopIndex('map')]}
            stopRef={(el) => {
              stopRefs.current[stopIndex('map')] = el;
            }}
            stopHeight={stopHeight}
            viewportRoot={scrollRef}
          >
            <IntroMapDemo
              shops={mapDemoShops}
              frameHeight={isDesktop ? 500 : undefined}
              favoriteIds={favoriteIds}
              selectedShopId={openShop?.source === 'map' ? openShop.shop.id : null}
              onSelectShop={openShopFrom('map')}
            />
          </IntroSection>

          <IntroSection
            index={stopIndex('search')}
            step="02"
            title={stopLabels[stopIndex('search')]}
            stopRef={(el) => {
              stopRefs.current[stopIndex('search')] = el;
            }}
            stopHeight={stopHeight}
            viewportRoot={scrollRef}
          >
            <IntroSearchDemo
              shops={searchDemoShops}
              categories={searchCategories}
              frameHeight={isDesktop ? 380 : undefined}
              favoriteIds={favoriteIds}
              selectedShopId={openShop?.source === 'search' ? openShop.shop.id : null}
              onSelectShop={openShopFrom('search')}
            />
          </IntroSection>

          <IntroSection
            index={stopIndex('consult')}
            step="03"
            title={stopLabels[stopIndex('consult')]}
            stopRef={(el) => {
              stopRefs.current[stopIndex('consult')] = el;
            }}
            stopHeight={stopHeight}
            viewportRoot={scrollRef}
          >
            <IntroConsultDemo />
          </IntroSection>

          {showOdekake && (
            <IntroSection
              index={stopIndex('odekake')}
              step="04"
              title={stopLabels[stopIndex('odekake')]}
              stopRef={(el) => {
                stopRefs.current[stopIndex('odekake')] = el;
              }}
              stopHeight={stopHeight}
              viewportRoot={scrollRef}
            >
              <IntroOdekakeDemo
                guide={odekake}
                frameHeight={isDesktop ? 500 : undefined}
                onOpenSpot={openSpotCard}
              />
            </IntroSection>
          )}

          {/* ── 締め。にちよさんの最後の停留点 ──
              1画面ぶんの高さを取り、最後の1枚として先頭で揃う。
              見出し・にちよさんの一言・読み直し方を真ん中にまとめる。
              上に寄せると下半分が空いて見え、下に寄せると停留点が見えるまで間がある */}
          <section
            data-intro-stop={stopIndex('end')}
            className="relative z-[1] flex snap-start snap-always flex-col border-t border-nicchyo-ink/[0.07] py-9 md:py-11"
            style={scrollerHeight > 0 ? { minHeight: scrollerHeight } : undefined}
          >
            <div className="my-auto">
              <div className="pl-[var(--intro-rail)] pr-5 md:pr-8">
                <h3 className="text-[24px] font-extrabold leading-tight tracking-tight text-nicchyo-ink md:text-[28px]">
                  {siteText('mapIntro.endTitle')}
                </h3>
              </div>
              <div
                ref={(el) => {
                  stopRefs.current[stopIndex('end')] = el;
                }}
                className="mt-3"
                style={{ height: stopHeight }}
              />
              <div className="pl-[var(--intro-rail)] pr-5 md:pr-8">
                <p className="text-[13px] font-semibold leading-relaxed text-nicchyo-ink/50 md:text-[14px]">
                  {siteText('mapIntro.reread')}
                </p>
                <Link
                  href="/about"
                  className="mt-5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-nicchyo-ink/50 underline-offset-4 transition hover:text-nicchyo-ink/80 hover:underline"
                >
                  {siteText('mapIntro.aboutLink')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* いつでも地図へ戻れるようにする操作列。左に進み具合、右に地図へ戻るボタン */}
      <div
        className="shrink-0 border-t border-nicchyo-ink/[0.07] bg-nicchyo-base/95 px-5 pt-2.5 backdrop-blur-sm md:px-8 md:py-3.5"
        style={isDesktop ? undefined : { paddingBottom: `calc(${NAV_SPACE} + 0.625rem)` }}
      >
        <div className="flex items-center justify-between gap-4">
          <IntroProgress active={activeStop} labels={stopLabels} onSelect={scrollToStop} />
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-nicchyo-primary py-3.5 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(126,217,87,0.9)] transition active:scale-[0.98] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2 md:w-[240px] md:flex-none"
          >
            {siteText('mapIntro.close')}
          </button>
        </div>
      </div>

      {/*
        本番と同じ、下から全開まで開くバナー。
        デモの枠の中に収めると写真と見出しで切れてしまうので、案内全体の上に開く
      */}
      <AnimatePresence>
        {openShop && (
          <motion.div
            key="intro-shop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30"
          >
            <button
              type="button"
              onClick={closeShop}
              aria-label="バナーを閉じる"
              className="absolute inset-0 cursor-default bg-nicchyo-ink/30 backdrop-blur-[1px]"
            />
            <IntroShopSheet
              shop={openShop.shop}
              isFavorite={favoriteIds.includes(openShop.shop.id)}
              onToggleFavorite={() => toggleFavorite(openShop.shop.id)}
              onClose={closeShop}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        お手洗いの印を押したときの、本番と同じスポットカード。
        地図（map）は無いので寄せる動きは無く、現在地からの道のりも出さない。
        「ここへ案内」を押すと、デモの案内先がそのお手洗いに切り替わる
      */}
      <AnimatePresence>
        {openSpot && (
          <motion.div
            key="intro-spot-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30"
          >
            <button
              type="button"
              onClick={closeSpotCard}
              aria-label="スポットカードを閉じる"
              className="absolute inset-0 cursor-default bg-nicchyo-ink/30 backdrop-blur-[1px]"
            />
            {/* スマホはナビゲーションバーの上で止める。バーの裏に「ここへ案内」が隠れないように */}
            <div
              className="absolute inset-x-0 top-0"
              style={{ bottom: isDesktop ? 0 : NAV_SPACE }}
            >
              <SpotCard
                spot={openSpot}
                map={null}
                origin={null}
                onClose={closeSpotCard}
                onNavigate={navigateFromSpotCard}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
          // ナビゲーションバー（z-[9997]）より手前。暗幕の上にナビだけ明るく残ると、
          // 案内の外に別の操作があるように見える
          className="fixed inset-0 z-[9998]"
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
          {/*
            外側は出入りの動き（下から上がる・下へ消える）だけ。
            高さ・引き下げ・角丸は指の作法（useSheetGestures）が motion value で直接動かす。
            同じ要素で animate と手動の値を混ぜると、指を離した瞬間に取り合いになる
          */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg"
          >
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="false"
              aria-labelledby="map-intro-title"
              style={{
                height: sheetHeight,
                y: sheetPull,
                borderTopLeftRadius: sheetRadius,
                borderTopRightRadius: sheetRadius,
              }}
              className="relative flex flex-col overflow-hidden bg-nicchyo-base shadow-[0_-16px_48px_-12px_rgba(58,58,58,0.3)] ring-1 ring-nicchyo-ink/[0.07] [-webkit-tap-highlight-color:transparent]"
            >
              {/*
                つまみ。指で引くのが本来の作法だが、押しても段が切り替わる
                （全画面 ⇄ 半開き）ので、引く操作が難しい人にも同じことができる
              */}
              <button
                type="button"
                onClick={toggleSheet}
                aria-label={expanded ? '案内を半分にたたむ' : '案内を全画面に広げる'}
                className="flex h-7 w-full shrink-0 items-center justify-center focus-visible:outline-none"
              >
                <span className="h-1 w-10 rounded-full bg-nicchyo-ink/15" />
              </button>
              {content}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
