import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, useMotionValue, useTransform } from 'framer-motion';
import { vibrate } from '@/lib/ui/haptics';

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
/** 段へ吸い付く動きがほぼ収まるまでの時間（DETENT_SPRING の実測） */
const EXPAND_SETTLE_MS = 320;
/** 半開きのときの角丸 */
const SHEET_RADIUS = 28;

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
export function useIntroSheetGestures({
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
  /** にちよさんをつまんで送るときの、中身の動かし方 */
  scrub: { start: () => void; to: (scrollTop: number) => void; end: () => void };
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
  /** にちよさんをつまんで送っている最中か。そのあいだは中身が動いても段を変えない */
  const scrubbingRef = useRef(false);
  /** 手で送ったあと scroll-snap を戻すまでの待ち */
  const restoreSnapTimerRef = useRef<number | null>(null);

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
      if (byGesture && changed) vibrate(DETENT_HAPTIC_MS);
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
    // つまんで送っているあいだは半開きのまま。離したときに広げる
    if (scrubbingRef.current) return;
    const el = scrollRef.current;
    if (el && el.scrollTop > EXPAND_SCROLL_PX && !expandedRef.current) settle('full');
  }, [settle]);

  /** 手で送ったあと、近い節の先頭へ寄せてから scroll-snap を戻す */
  const resnap = useCallback(() => {
    const el = scrollRef.current;
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
    if (restoreSnapTimerRef.current !== null) window.clearTimeout(restoreSnapTimerRef.current);
    restoreSnapTimerRef.current = window.setTimeout(() => {
      restoreSnapTimerRef.current = null;
      el.style.scrollSnapType = '';
    }, target !== st && !reduceMotion ? 450 : 0);
  }, [reduceMotion]);

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

    const scroller = () => scrollRef.current;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      // にちよさんの上から始まった指は、にちよさんが受け持つ（IntroGrandmaRail）。
      // シートを動かしも、中身を送りもしない
      if ((event.target as Element | null)?.closest?.('[data-intro-grab]')) {
        gesture = null;
        return;
      }
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
      if (restoreSnapTimerRef.current !== null) window.clearTimeout(restoreSnapTimerRef.current);
      if (scrollerAtMount) scrollerAtMount.style.scrollSnapType = '';
    };
  }, [height, pull, reduceMotion, resnap, settle, sheetEl]);

  /*
   * にちよさんをつまんで送るとき。指が付いているあいだは scroll-snap を切って
   * 指なりに送り、離したら手で送ったときと同じく近い節の先頭へ寄せる。
   * 半開きのままつまんだときは、引いているあいだはシートを動かさず（指の下で
   * シートが伸びると絵が指から離れる）、離してから全画面に広げる
   */
  const scrub = useMemo(
    () => ({
      start: () => {
        scrubbingRef.current = true;
        if (restoreSnapTimerRef.current !== null) {
          window.clearTimeout(restoreSnapTimerRef.current);
          restoreSnapTimerRef.current = null;
        }
        const el = scrollRef.current;
        if (el) el.style.scrollSnapType = 'none';
      },
      to: (scrollTop: number) => {
        const el = scrollRef.current;
        if (el) el.scrollTop = scrollTop;
      },
      end: () => {
        scrubbingRef.current = false;
        const scrolled = (scrollRef.current?.scrollTop ?? 0) > EXPAND_SCROLL_PX;
        if (!expandedRef.current && scrolled) {
          // 半開きのままつまんでいたら、まず全画面に広げる。寄せる先はシートが
          // 広がりきった高さで決めないと、背の高い節の途中で止まってしまう
          settle('full');
          window.setTimeout(resnap, reduceMotion ? 0 : EXPAND_SETTLE_MS);
          return;
        }
        resnap();
      },
    }),
    [reduceMotion, resnap, settle]
  );

  return { expanded, sheetRef, scrollRef, height, pull, radius, onScroll, onWheel, expand, collapse, toggle, scrub };
}
