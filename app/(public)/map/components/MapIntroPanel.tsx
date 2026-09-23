'use client';

/**
 * MapIntroPanel
 *
 * 初来訪者に「ここが何のサービスか」を伝える案内パネル。
 *
 * 独立した LP ページではなく、読み込み終わったマップの上に下から重ねる。
 * 最初は画面の6割ほどで開き、上に地図が見えたままにする。シートは指に付いてきて、
 * 離した速さと位置で「半開き」か「全画面」の段に吸い付く（useSheetGestures）。
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
 * スクロールに合わせて降りてきて、見出しのすぐ下で一言しゃべる（IntroGrandmaRail）。
 * 節ごとに絵を置くと「何人もいる」ことになり、案内していた人がいなくなる。
 *
 * 出す条件は useMapIntro が持つ。ここは見た目と開き方だけを受け持つ。
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight, ChevronUp, Map as MapIcon, MessageCircle, Tag, X } from 'lucide-react';
import type { Shop } from '../types/shopData';
import { SHOP_CATEGORY_NAMES } from '../config/shopCategories';
import IntroMapDemo from './intro/IntroMapDemo';
import IntroSearchDemo from './intro/IntroSearchDemo';
import IntroConsultDemo from './intro/IntroConsultDemo';
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

type MapIntroPanelProps = {
  /** 開いているか。閉じる動きはこの部品の中の AnimatePresence が受け持つ */
  open: boolean;
  /** マップページが既に読み込んでいる店舗。デモはここから数件借りる */
  shops?: Shop[];
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

/** これ以上スクロールしたら全画面に広げる（ホイールや点からの移動の分） */
const EXPAND_SCROLL_PX = 6;
/** 半開きからさらにこれだけ引き下げて離したら閉じる（px、抵抗をかける前の指の量） */
const DISMISS_PULL_PX = 110;
/** これより速く払ったら、位置に関係なく払った向きの段へ（px/ms） */
const FLICK_VELOCITY = 0.45;
/** 半開きより下へ引くときの抵抗。1 で指と同じ、0 で動かない */
const OVERPULL_RESISTANCE = 0.5;
/** 指の向きを決めるまでの遊び（px） */
const GESTURE_SLOP_PX = 3;
/** 段に着いたときの手応え（対応端末のみ。iOS は無視する） */
const DETENT_HAPTIC_MS = 8;
/** 段へ吸い付く動き。速く、行き過ぎない */
const DETENT_SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const;
/** ナビゲーションバー（h-14）の分。下の操作列が隠れないようにする */
const NAV_SPACE = 'calc(3.5rem + var(--safe-bottom, 0px))';
/** 半開きのときの角丸 */
const SHEET_RADIUS = 28;

const DESKTOP_QUERY = '(min-width: 768px)';

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
 * ボトムシートの段（ディテント）と指の作法。
 *
 * 段は「半開き」と「全画面」の2つ。Apple Maps や Google Maps のシートと同じで、
 * 指を置いて動かしているあいだはシートの上端が指に 1:1 で付いてくる（しきい値で
 * 急に切り替わらない）。離したら、速く払っていればその向きの段へ、ゆっくりなら
 * 近いほうの段へ吸い付く。半開きからさらに下へ引くと、抵抗を受けながら
 * シート全体が下がり、離したところで閉じる。
 *
 * どの指の動きがシートのもので、どれが中身のスクロールかは、最初の一動きで決める。
 *   半開き           … 上下どちらへ動かしてもシート（中身はまだ読む段ではない）
 *   全画面で先頭     … 下へ引いたらシート、上へ送ったら中身のスクロール
 *   全画面で途中     … 中身のスクロール
 * シートと決めたときだけ touchmove を preventDefault して、ブラウザのスクロールを
 * 止める。React の onTouchMove は passive で preventDefault が効かないので、
 * ここだけ素の addEventListener（passive: false）で付ける。
 *
 * 半開きから上へ引き続けて全画面に着いたあとは、残りの指の動きぶんだけ中身を
 * 手で送る。指を離さずに「持ち上げてそのまま読み始める」ができる。
 * 手で送っているあいだは scroll-snap を切り、離してから近い節へ寄せて戻す
 * （切らないと、送るたびに節の先頭へ跳ね戻されて指に付いてこない）。
 */
function useSheetGestures({
  peekHeight,
  fullHeight,
  onClose,
  reduceMotion,
}: {
  peekHeight: number;
  fullHeight: number;
  onClose: () => void;
  reduceMotion: boolean;
}): {
  expanded: boolean;
  /** シートの要素を受け取る callback ref。要素が作り直されるたびに指の作法を付け直す */
  sheetRef: (el: HTMLDivElement | null) => void;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  height: ReturnType<typeof useMotionValue<number>>;
  pull: ReturnType<typeof useMotionValue<number>>;
  radius: ReturnType<typeof useTransform<number, number>>;
  onScroll: () => void;
  onWheel: (event: React.WheelEvent) => void;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
} {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  /*
   * シートの要素は state で持つ。閉じると要素ごと消え、開き直すと新しい要素になる。
   * useRef だと effect が初回の要素にしか listener を付けず、開き直したあとは
   * 指に付いてこなくなる
   */
  const [sheetEl, setSheetEl] = useState<HTMLDivElement | null>(null);
  const sheetRef = useCallback((el: HTMLDivElement | null) => setSheetEl(el), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const sizeRef = useRef({ peek: peekHeight, full: fullHeight });
  sizeRef.current = { peek: peekHeight, full: fullHeight };

  /** シートの高さ。半開きと全画面のあいだを指なりに動く */
  const height = useMotionValue(peekHeight);
  /** 半開きよりさらに下へ引いた量。シート全体を下げる */
  const pull = useMotionValue(0);
  /** 角丸。全画面に近づくほど角が立つ */
  const radius = useTransform(height, (h) => {
    const { peek, full } = sizeRef.current;
    if (full <= peek) return SHEET_RADIUS;
    const t = Math.min(1, Math.max(0, (h - peek) / (full - peek)));
    return SHEET_RADIUS * (1 - t);
  });

  const draggingRef = useRef(false);

  const settle = useCallback(
    (target: 'peek' | 'full', byGesture = false) => {
      const { peek, full } = sizeRef.current;
      const changed = expandedRef.current !== (target === 'full');
      expandedRef.current = target === 'full';
      setExpanded(target === 'full');
      const to = target === 'full' ? full : peek;
      if (reduceMotion) height.set(to);
      else animate(height, to, DETENT_SPRING);
      if (pull.get() !== 0) {
        if (reduceMotion) pull.set(0);
        else animate(pull, 0, DETENT_SPRING);
      }
      if (byGesture && changed && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(DETENT_HAPTIC_MS);
        } catch {
          /* 対応していない端末では何もしない */
        }
      }
    },
    [height, pull, reduceMotion]
  );

  const expand = useCallback(() => settle('full'), [settle]);
  const collapse = useCallback(() => {
    settle('peek');
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [settle]);
  const toggle = useCallback(() => {
    if (expandedRef.current) collapse();
    else expand();
  }, [collapse, expand]);

  // 画面の高さが変わったら（アドレスバーの出入り・回転）、いまの段の高さに合わせ直す
  useEffect(() => {
    if (draggingRef.current) return;
    height.set(expandedRef.current ? fullHeight : peekHeight);
  }, [fullHeight, height, peekHeight]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el && el.scrollTop > EXPAND_SCROLL_PX && !expandedRef.current) settle('full');
  }, [settle]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.deltaY > 0 && !expandedRef.current) settle('full');
      else if (event.deltaY < 0 && (scrollRef.current?.scrollTop ?? 0) <= 0) collapse();
    },
    [collapse, settle]
  );

  // ── 指の作法 ──
  useEffect(() => {
    const sheet = sheetEl;
    if (!sheet) return;

    type Gesture = {
      startY: number;
      startOffset: number;
      startScrollTop: number;
      mode: 'undecided' | 'sheet' | 'scroll';
      /** 速さを出すための直近の指の位置 */
      samples: Array<{ t: number; y: number }>;
      /** 全画面に着いたあと、中身を手で送ったか */
      scrolledByHand: boolean;
    };
    let gesture: Gesture | null = null;
    let restoreSnapTimer: number | null = null;

    const scroller = () => scrollRef.current;

    /** 手で送ったあと、近い節の先頭へ寄せてから scroll-snap を戻す */
    const resnap = () => {
      const el = scroller();
      if (!el) return;
      const view = el.clientHeight;
      const st = el.scrollTop;
      const maxTop = el.scrollHeight - view;
      const tops = Array.from(el.querySelectorAll<HTMLElement>('[data-intro-stop]')).map((node) => {
        const top = Math.round(node.getBoundingClientRect().top - el.getBoundingClientRect().top + st);
        return { top: Math.min(top, maxTop), bottom: top + node.offsetHeight };
      });
      // 画面より背の高い節の中に居るなら、そのまま（snap もそこは自由に動ける）
      const covered = tops.some((sec) => sec.top <= st && sec.bottom >= st + view);
      let target = st;
      if (!covered && tops.length > 0) {
        target = tops.reduce((best, sec) =>
          Math.abs(sec.top - st) < Math.abs(best - st) ? sec.top : best, tops[0].top);
      }
      if (target !== st) el.scrollTo({ top: target, behavior: reduceMotion ? 'auto' : 'smooth' });
      if (restoreSnapTimer !== null) window.clearTimeout(restoreSnapTimer);
      restoreSnapTimer = window.setTimeout(() => {
        restoreSnapTimer = null;
        el.style.scrollSnapType = '';
      }, target !== st && !reduceMotion ? 450 : 0);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const { full } = sizeRef.current;
      gesture = {
        startY: y,
        startOffset: full - height.get() + pull.get() / OVERPULL_RESISTANCE,
        startScrollTop: scroller()?.scrollTop ?? 0,
        mode: 'undecided',
        samples: [{ t: event.timeStamp, y }],
        scrolledByHand: false,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      const dy = y - gesture.startY;
      gesture.samples.push({ t: event.timeStamp, y });
      if (gesture.samples.length > 6) gesture.samples.shift();

      if (gesture.mode === 'undecided') {
        if (Math.abs(dy) < GESTURE_SLOP_PX) return;
        const atTop = (scroller()?.scrollTop ?? 0) <= 0;
        const sheetOwns = !expandedRef.current || (atTop && dy > 0);
        gesture.mode = sheetOwns ? 'sheet' : 'scroll';
        if (sheetOwns) draggingRef.current = true;
      }
      if (gesture.mode !== 'sheet') return;
      if (!event.cancelable) return;
      event.preventDefault();

      const { peek, full } = sizeRef.current;
      const range = full - peek;
      // offset = 全画面の上端から、いまのシートの上端までの距離
      const offset = gesture.startOffset + dy;
      const el = scroller();
      if (offset < 0) {
        // 全画面より上へ引いている → 残りは中身を手で送る
        height.set(full);
        pull.set(0);
        if (el) {
          if (!gesture.scrolledByHand) {
            gesture.scrolledByHand = true;
            gesture.startScrollTop = el.scrollTop;
            el.style.scrollSnapType = 'none';
          }
          el.scrollTop = gesture.startScrollTop - offset;
        }
      } else if (offset <= range) {
        height.set(full - offset);
        pull.set(0);
      } else {
        height.set(peek);
        pull.set((offset - range) * OVERPULL_RESISTANCE);
      }
    };

    const finish = (cancelled: boolean) => {
      if (!gesture) return;
      const g = gesture;
      gesture = null;
      if (g.mode !== 'sheet') return;
      draggingRef.current = false;

      // 直近 80ms ほどの動きから速さを出す（px/ms、下向きが正）
      const last = g.samples[g.samples.length - 1];
      let first = g.samples[0];
      for (const sample of g.samples) {
        if (last.t - sample.t <= 90) {
          first = sample;
          break;
        }
      }
      const dt = Math.max(1, last.t - first.t);
      const velocity = cancelled ? 0 : (last.y - first.y) / dt;

      const { peek, full } = sizeRef.current;
      const range = full - peek;

      if (pull.get() > 0) {
        const pulled = pull.get() / OVERPULL_RESISTANCE;
        if (!cancelled && (pulled > DISMISS_PULL_PX || velocity > FLICK_VELOCITY)) {
          onCloseRef.current();
          return;
        }
        settle('peek', true);
        return;
      }

      const offset = full - height.get();
      let target: 'peek' | 'full';
      if (velocity > FLICK_VELOCITY) target = 'peek';
      else if (velocity < -FLICK_VELOCITY) target = 'full';
      else target = offset < range / 2 ? 'full' : 'peek';
      if (g.scrolledByHand) target = 'full';
      settle(target, true);
      if (g.scrolledByHand) resnap();
      if (target === 'peek' && scrollRef.current) scrollRef.current.scrollTop = 0;
    };

    const onTouchEnd = () => finish(false);
    const onTouchCancel = () => finish(true);

    const scrollerAtMount = scrollRef.current;
    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd);
    sheet.addEventListener('touchcancel', onTouchCancel);
    return () => {
      sheet.removeEventListener('touchstart', onTouchStart);
      sheet.removeEventListener('touchmove', onTouchMove);
      sheet.removeEventListener('touchend', onTouchEnd);
      sheet.removeEventListener('touchcancel', onTouchCancel);
      if (restoreSnapTimer !== null) window.clearTimeout(restoreSnapTimer);
      if (scrollerAtMount) scrollerAtMount.style.scrollSnapType = '';
    };
  }, [height, pull, reduceMotion, settle, sheetEl]);

  return { expanded, sheetRef, scrollRef, height, pull, radius, onScroll, onWheel, expand, collapse, toggle };
}

/**
 * にちよさんが立ち寄る順に並べた一言。
 *
 * 節ごとの説明はここに集約する。薄い字の説明文を別に置くと、案内している人の
 * 言葉と地の文が二重になるので、説明はにちよさんに言ってもらう。
 */
const RAIL_COMMENTS = [
  'ようこそ、日曜市へ。まずはわしが、ざっと案内するきね。',
  '屋台の写真が順に出てくるき。気になった店を押したら、中が見えるき。',
  '何があるか分からんときは、ジャンルから見たらえいよ。',
  '探すより聞くほうが早いこともあるき。なんでも聞いてや。',
  'ほんなら、いってらっしゃい。ええ日曜市になるきね。',
] as const;

/** 停留点の名前。進み具合の点の読み上げと、締めの振り返りに使う */
const STOP_LABELS = ['ようこそ', '地図で店を探す', 'ジャンルでしぼる', 'にちよさんに聞く', 'おわり'] as const;

/** 締めで振り返る、できること3つ */
const RECAP = [
  { stop: 1, Icon: MapIcon, title: '地図で店を探す', note: '屋台を押すと、写真と中が見える' },
  { stop: 2, Icon: Tag, title: 'ジャンルでしぼる', note: '押したジャンルの店だけ残る' },
  { stop: 3, Icon: MessageCircle, title: 'にちよさんに聞く', note: '迷ったら、なんでも聞ける' },
] as const;

/**
 * 進み具合。いまどの節にいるかを点の並びで示し、押せばその節へ飛ぶ。
 *
 * いま居る点だけ長く伸ばす。通り過ぎた点は薄い緑、まだの点は灰色。
 * 「あと何節あるか」が読む前に分かるので、長い案内でも先が見える。
 */
function IntroProgress({
  active,
  labels,
  onSelect,
}: {
  active: number;
  labels: readonly string[];
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="案内の進み具合" className="-ml-2 flex items-center">
      {labels.map((label, i) => {
        const state = i === active ? 'current' : i < active ? 'done' : 'todo';
        return (
          <button
            key={label}
            type="button"
            aria-current={i === active ? 'step' : undefined}
            aria-label={label}
            onClick={() => onSelect(i)}
            className="flex h-11 w-7 items-center justify-center focus-visible:outline-none"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                state === 'current'
                  ? 'w-6 bg-nicchyo-primary'
                  : state === 'done'
                    ? 'w-1.5 bg-nicchyo-primary/45'
                    : 'w-1.5 bg-nicchyo-ink/15'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * デモを1つ抱えた区画。縦に積んで、上から順に読めるようにする。
 *
 * 見出しの下には、にちよさんと吹き出しが入るぶんの場所だけ空けておく。
 * 中身（絵と言葉）はレール側が1組だけ持っていて、その場所まで降りてくる。
 *
 * デモは節が画面に入ったときに一度だけ、下からふわりと現れる。
 * 節ごとに止まるスクロールと合わせて、1節が1枚のスライドとして立ち上がる。
 */
function IntroSection({
  index,
  step,
  title,
  stopRef,
  stopHeight,
  viewportRoot,
  children,
}: {
  index: number;
  step: string;
  title: string;
  stopRef: (el: HTMLDivElement | null) => void;
  stopHeight: number;
  viewportRoot: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    /* 道（絶対配置の SVG）より手前に置く。relative を付けないと、
       位置指定のない中身のほうが下に潜って、文字の上を道が横切る。
       snap-start / snap-always で、この節の先頭がスクロールの止まる位置になる */
    <section
      data-intro-stop={index}
      className="relative z-[1] snap-start snap-always border-t border-nicchyo-ink/[0.07] pb-9 pt-8 md:py-11"
    >
      <div className="flex items-center gap-2.5 pl-[var(--intro-rail)] pr-5 md:pr-8">
        <span className="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-full bg-nicchyo-primary px-1 text-[11.5px] font-extrabold tracking-wider text-white shadow-[0_4px_10px_-4px_rgba(126,217,87,0.9)]">
          {step}
        </span>
        <h3 className="text-[20px] font-extrabold leading-tight tracking-tight text-nicchyo-ink md:text-[22px]">
          {title}
        </h3>
      </div>
      {/* にちよさんの停留点。高さだけ確保しておく */}
      <div ref={stopRef} className="mt-3" style={{ height: stopHeight }} />
      {/*
        スマホはデモを端まで使う（地図は広いほうがよい）。
        PC は見出しと左端を揃え、右端はダイアログの余白に揃える。
      */}
      <motion.div
        className="mt-3 px-5 md:pl-[var(--intro-rail)] md:pr-8"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ root: viewportRoot, once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </section>
  );
}

type OpenShop = { shop: IntroDemoShop; source: 'map' | 'search' };

export default function MapIntroPanel({ open, shops, onClose }: MapIntroPanelProps) {
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
  } = useSheetGestures({ peekHeight, fullHeight: viewportHeight, onClose, reduceMotion });

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
    const scroller = scrollRef.current;
    if (scroller) {
      // 組み上がった直後の一瞬、この枠は親の高さが効く前で中身なりの高さになる。
      // その値をそのまま使うと締めの節が何画面ぶんにも伸びるので、画面の高さで頭を押さえる
      const height = Math.min(
        scroller.clientHeight,
        window.innerHeight > 0 ? window.innerHeight : scroller.clientHeight
      );
      setScrollerHeight((prev) => (prev === height ? prev : height));
    }
  }, [scrollRef]);

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
  useEffect(() => {
    if (open) return;
    setActiveStop(0);
    setOpenShop(null);
    scrollY.set(0);
    collapse();
  }, [open, collapse, scrollY]);

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

  /** 進み具合の点や締めの振り返りから、その節の先頭へ */
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
            targetStop={activeStop}
            comments={RAIL_COMMENTS}
            stopHeight={stopHeight}
            scrollY={scrollY}
            viewHeight={scrollerHeight}
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
                はじめての方へ
              </span>
              <h2
                id="map-intro-title"
                className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-tight text-nicchyo-ink md:text-[32px]"
              >
                ようこそ、日曜市へ
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
                <b className="font-bold text-nicchyo-ink">毎週日曜</b>
                、高知城のふもとから追手筋まで
                <b className="font-bold text-nicchyo-ink">約1.3km</b>
                。<b className="font-bold text-nicchyo-ink">およそ300の店</b>が並びます。
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[1.85] text-nicchyo-ink/55 md:text-[14px]">
                nicchyo（ニッチョ）は、はじめての人がそこを歩くための地図です。
              </p>

              <div className="pb-4" />
            </div>
          </div>

          {/* ── 機能ごとのデモ ── */}
          <IntroSection
            index={1}
            step="01"
            title={STOP_LABELS[1]}
            stopRef={(el) => {
              stopRefs.current[1] = el;
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
            index={2}
            step="02"
            title={STOP_LABELS[2]}
            stopRef={(el) => {
              stopRefs.current[2] = el;
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
            index={3}
            step="03"
            title={STOP_LABELS[3]}
            stopRef={(el) => {
              stopRefs.current[3] = el;
            }}
            stopHeight={stopHeight}
            viewportRoot={scrollRef}
          >
            <IntroConsultDemo />
          </IntroSection>

          {/* ── 締め。にちよさんの最後の停留点 ──
              1画面ぶんの高さを取り、最後の1枚として先頭で揃う。
              できること3つを振り返り、押せばその節へ戻れる */}
          <section
            data-intro-stop={4}
            className="relative z-[1] flex snap-start snap-always flex-col border-t border-nicchyo-ink/[0.07] py-9 md:py-11"
            style={scrollerHeight > 0 ? { minHeight: scrollerHeight } : undefined}
          >
            <div className="pl-[var(--intro-rail)] pr-5 md:pr-8">
              <h3 className="text-[24px] font-extrabold leading-tight tracking-tight text-nicchyo-ink md:text-[28px]">
                日曜市を楽しんで！
              </h3>
              <p className="mt-2 text-[13px] font-semibold text-nicchyo-ink/50 md:text-[14px]">
                この案内は、メニューの「はじめての方へ」からいつでも読み直せます
              </p>
            </div>
            <div
              ref={(el) => {
                stopRefs.current[4] = el;
              }}
              className="mt-3"
              style={{ height: stopHeight }}
            />
            <div className="mt-2 flex flex-1 flex-col pl-[var(--intro-rail)] pr-5 md:pr-8">
              {/* 振り返りは残りの高さの真ん中に。上に寄せると下半分が空いて見える */}
              <ul className="my-auto space-y-2 py-2">
                {RECAP.map(({ stop, Icon, title, note }) => (
                  <li key={stop}>
                    <button
                      type="button"
                      onClick={() => scrollToStop(stop)}
                      className="group flex w-full items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3 text-left ring-1 ring-nicchyo-ink/[0.06] transition hover:bg-white active:scale-[0.99]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nicchyo-primary/15 text-emerald-700">
                        <Icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-nicchyo-ink">{title}</span>
                        <span className="block text-[12px] text-nicchyo-ink/55">{note}</span>
                      </span>
                      <ChevronUp
                        className="h-4 w-4 shrink-0 text-nicchyo-ink/30 transition group-hover:text-nicchyo-ink/60"
                        aria-hidden
                      />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="pt-5">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-nicchyo-ink/50 underline-offset-4 transition hover:text-nicchyo-ink/80 hover:underline"
                >
                  nicchyo について詳しく
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
          <IntroProgress active={activeStop} labels={STOP_LABELS} onSelect={scrollToStop} />
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-nicchyo-primary py-3.5 text-[15px] font-bold text-white shadow-[0_6px_16px_-6px_rgba(126,217,87,0.9)] transition active:scale-[0.98] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2 md:w-[240px] md:flex-none"
          >
            地図をみる
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
