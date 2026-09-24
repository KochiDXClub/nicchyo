'use client';

/**
 * 案内パネルを縦に貫く、にちよさんの道。
 *
 * 案内の中でにちよさんの絵は1枚だけにして、スクロールと一緒にその1枚が
 * 道を降りていく。停留点は各見出しのすぐ下で、そこに着いたときだけ一言しゃべる。
 * 絵を節ごとに置くと「何人もいる」ことになり、案内していた人がいなくなる。
 *
 * 【動き方】
 * スクロール位置から「いま居るべき道の位置」を連続的に決める（節の先頭にいれば
 * その節の停留点、節と節のあいだならそのぶんだけ途中）。にちよさんはそこへ向かって
 * 毎フレーム歩く。速さの上限は人が歩くくらい（WALK_SPEED_PX_PER_SEC）で、
 *   ・それより遅くスクロールしていれば、同じ速さで一緒に動く（画面上でほぼ止まって見える）
 *   ・それより速く送られれば、遅れて追いかけ、止まってから追いつく
 *   ・途中で止まれば、そこで止まる（停留点でなければ何も言わない）
 * 停留点に着いて止まったときだけ吹き出しを出す。動いている間は何も言わない。
 *
 * 道は静かな波線で常に描いておく。降りる先が見えていると、下にまだ続きがあることが
 * 読む前に分かる。デモの枠は不透明なので、その裏は通り抜けているように見える。
 *
 * 絵は相談ページと同じ GrandmaAvatar（構えが変わると会釈する）、吹き出しも
 * 相談ページと同じもの（.consult-greeting）を、尻尾だけ左向きにして使う。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import GrandmaAvatar from '../../../consult/components/GrandmaAvatar';
import { DEFAULT_CONSULT_CHARACTER } from '../../../consult/data/consultCharacters';
import type { GrandmaPose } from '@/lib/grandma/pose';

/** 左に空ける道の幅。停留点の行はこのぶんだけ右に寄せる */
export const RAIL_WIDTH = 72;
/**
 * 停留点の行に確保する高さ。
 * スマホは吹き出しが2行になるぶん高く、PC は横幅があって1行に収まるので低くする。
 * ここを高くしすぎると、にちよさんがまだ来ていない停留点が「ぽっかり空いた穴」に見える。
 */
export const RAIL_STOP_HEIGHT = 92;
export const RAIL_STOP_HEIGHT_DESKTOP = 80;

const RAIL_CENTER_X = 34;
const WAVE_AMPLITUDE = 11;
const WAVE_LENGTH = 220;
const AVATAR_SIZE = 64;
/** 着いてからしゃべっている時間 */
const SPEAK_MS = 2200;
/** 歩く速さの上限（px/秒）。これより遅いスクロールには同じ速さで付いていく */
const WALK_SPEED_PX_PER_SEC = 420;
/** 目的地の手前この距離から減速して、ぴたりと止まる */
const ARRIVE_EASE_PX = 28;
/**
 * これより小さなずれは歩かずに立ち位置を直す。
 * 停留点は測り直しで数 px 動くことがあり、そのたびに歩いて
 * 吹き出しをしまっていては落ち着かない。スクロール中は使わない
 */
const SNAP_PX = 12;
/** 停留点からこの距離までなら「そこに立っている」とみなして一言言う */
const STANDING_PX = 8;
/** スクロールが止まってからこれだけ経てば、位置のずれは測り直しによるものとみなす */
const SCROLL_SETTLE_MS = 160;
/** 動きが止まってからこれだけ経てば、歩き終えたとみなす（1〜2フレームの間は続いているとみなす） */
const WALK_SETTLE_MS = 120;
/** 一歩ぶんの上下。踏み出すたびに軽く弾む */
const WALK_BOB_PX = 4;
const WALK_STEP_SEC = 0.46;

/**
 * スクロール位置から「いま居るべき道の位置」を引く。
 * anchorYs[i] のスクロール位置で stopYs[i] にぴったり立ち、あいだは比例で埋める
 */
export function railPositionFor(scrollTop: number, anchorYs: number[], stopYs: number[]): number {
  const n = Math.min(anchorYs.length, stopYs.length);
  if (n === 0) return 0;
  if (scrollTop <= anchorYs[0]) return stopYs[0];
  for (let i = 0; i < n - 1; i += 1) {
    const a0 = anchorYs[i];
    const a1 = anchorYs[i + 1];
    if (scrollTop <= a1) {
      const span = a1 - a0;
      const t = span > 0 ? (scrollTop - a0) / span : 1;
      return stopYs[i] + (stopYs[i + 1] - stopYs[i]) * Math.min(1, Math.max(0, t));
    }
  }
  return stopYs[n - 1];
}

/** 道の横位置。y に応じて左右に揺れる */
export function railX(y: number): number {
  return RAIL_CENTER_X + WAVE_AMPLITUDE * Math.sin((2 * Math.PI * y) / WAVE_LENGTH);
}

/** 波線を 8px 刻みの折れ線で引く。曲線指定より読みやすく、見た目は変わらない */
function buildRailPath(height: number): string {
  if (height <= 0) return '';
  const points: string[] = [];
  for (let y = 0; y <= height; y += 8) {
    points.push(`${railX(y).toFixed(2)} ${y}`);
  }
  return `M ${points.join(' L ')}`;
}

export default function IntroGrandmaRail({
  height,
  stopYs,
  anchorYs,
  scrollY,
  comments,
  stopHeight = RAIL_STOP_HEIGHT,
}: {
  /** 道を引く高さ（案内の中身の高さ） */
  height: number;
  /** 各停留点の上端。中身の先頭からの px */
  stopYs: number[];
  /** 各停留点にぴったり立つスクロール位置（節の先頭）。stopYs と同じ並び */
  anchorYs: number[];
  /** いまのスクロール位置（中身の先頭からの px） */
  scrollY: MotionValue<number>;
  /** 停留点ごとに言うこと */
  comments: readonly string[];
  /** 停留点1つぶんの高さ */
  stopHeight?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [pose, setPose] = useState<GrandmaPose>('idle');
  const [walking, setWalking] = useState(false);
  /** 止まっている停留点。途中で止まっているときは null（何も言わない） */
  const [standing, setStanding] = useState<number | null>(null);

  /**
   * 縦の位置。これを動かすと、横の位置は道の式から引き直される。
   *
   * 以前は縦だけを動かして横は着いた先の値をそのまま入れていたので、
   * 歩き出した瞬間に横へ瞬間移動していた。道がくねっているぶん、
   * それが「宙を飛んでいる」ように見えていた。
   */
  const top = useMotionValue(0);
  const avatarLeft = useTransform(top, (y) => railX(y + AVATAR_SIZE / 2) - AVATAR_SIZE / 2);

  /** 停留点の位置を一度でも測れたか。測れる前の 0 からは歩かず、立ち位置だけ直す */
  const hasMeasuredRef = useRef(false);
  /** いま居るべき位置（スクロール位置から引いたもの） */
  const desiredRef = useRef(0);
  /** 最後にスクロールが動いた時刻 */
  const scrollMovedAtRef = useRef(0);
  /** 最後に足を動かした時刻と、歩いている最中か */
  const lastMovedAtRef = useRef(0);
  const walkingRef = useRef(false);

  const stopYsRef = useRef(stopYs);
  stopYsRef.current = stopYs;
  /**
   * 指が画面に触れているか。
   *
   * 指で送っている最中にここが毎フレーム描き換えると、離したあとの慣性が
   * 消えて節の途中で止まってしまう（Chrome は指が付いている間の中身の変化を
   * 見てジェスチャを切り直す）。触れている間は足を止め、離れてから追いかける。
   * ホイールやトラックパッド（PC）には指が無いので、常に一緒に動く
   */
  const fingerDownRef = useRef(false);
  useEffect(() => {
    const down = () => {
      fingerDownRef.current = true;
    };
    const up = (event: TouchEvent) => {
      if (event.touches.length === 0) fingerDownRef.current = false;
    };
    window.addEventListener('touchstart', down, { passive: true, capture: true });
    window.addEventListener('touchend', up, { passive: true, capture: true });
    window.addEventListener('touchcancel', up, { passive: true, capture: true });
    return () => {
      window.removeEventListener('touchstart', down, { capture: true });
      window.removeEventListener('touchend', up, { capture: true });
      window.removeEventListener('touchcancel', up, { capture: true });
    };
  }, []);

  /** いまの位置から、立っている停留点を引く */
  const standingAt = useCallback((y: number): number | null => {
    const ys = stopYsRef.current;
    for (let i = 0; i < ys.length; i += 1) {
      if (Math.abs(ys[i] - y) <= STANDING_PX) return i;
    }
    return null;
  }, []);

  // スクロールが動くたびに「居るべき位置」を引き直す。測り直しで停留点が動いたときも同じ
  useEffect(() => {
    const update = () => {
      desiredRef.current = railPositionFor(scrollY.get(), anchorYs, stopYs);
    };
    update();
    const unsubscribe = scrollY.on('change', () => {
      scrollMovedAtRef.current = performance.now();
      update();
    });
    return unsubscribe;
  }, [anchorYs, scrollY, stopYs]);

  // 開いた直後（まだ 0 に居る）は歩かず、居るべき位置に立つ
  useEffect(() => {
    if (stopYs.length === 0 || anchorYs.length === 0 || hasMeasuredRef.current) return;
    hasMeasuredRef.current = true;
    top.set(desiredRef.current);
    setStanding(standingAt(desiredRef.current));
  }, [anchorYs.length, standingAt, stopYs.length, top]);

  // 毎フレーム、居るべき位置へ向かって歩く
  useAnimationFrame((now, deltaMs) => {
    if (!hasMeasuredRef.current) return;
    // 指が触れているあいだは足を止め、離れてから追いかける（下の fingerDownRef 参照）
    if (fingerDownRef.current) return;
    const dt = Math.min(deltaMs, 64) / 1000;
    const current = top.get();
    const target = desiredRef.current;
    const delta = target - current;
    const scrolling = now - scrollMovedAtRef.current < SCROLL_SETTLE_MS;

    let step: number;
    let moved = false;
    if (reduceMotion) {
      step = delta;
    } else if (!walkingRef.current && !scrolling && Math.abs(delta) < SNAP_PX) {
      // 測り直しの小さなずれ。歩かずに立ち位置だけ直す
      step = delta;
    } else if (Math.abs(delta) < 0.5) {
      step = delta;
    } else {
      // 上限の速さで追いかける。手前では減速して、ぴたりと止まる
      const maxStep = WALK_SPEED_PX_PER_SEC * dt;
      const eased = Math.abs(delta) < ARRIVE_EASE_PX ? delta * Math.min(1, dt * 14) : delta;
      step = Math.max(-maxStep, Math.min(maxStep, eased));
      if (Math.abs(delta) >= 0.5 && Math.abs(step) < 0.15) step = Math.sign(delta) * 0.15;
      moved = true;
    }
    if (step !== 0) top.set(current + step);

    if (moved) {
      lastMovedAtRef.current = now;
      if (!walkingRef.current) {
        walkingRef.current = true;
        setWalking(true);
        setStanding(null);
      }
      return;
    }
    if (walkingRef.current && now - lastMovedAtRef.current > WALK_SETTLE_MS) {
      walkingRef.current = false;
      setWalking(false);
      setStanding(standingAt(top.get()));
    } else if (!walkingRef.current && step !== 0) {
      // 立ち位置を直したあとも、どの停留点に居るかは合わせておく
      const next = standingAt(top.get());
      setStanding((prev) => (prev === next ? prev : next));
    }
  });

  // 歩いているあいだは前を見て、停留点に着いたらしばらく話している顔にする
  useEffect(() => {
    if (walking || standing === null) {
      setPose('idle');
      return;
    }
    setPose('speaking');
    const timer = window.setTimeout(() => setPose('idle'), SPEAK_MS);
    return () => window.clearTimeout(timer);
  }, [walking, standing]);

  const path = useMemo(() => buildRailPath(height), [height]);

  return (
    <>
      {/* 道。中身の裏に敷く */}
      <svg
        className="pointer-events-none absolute left-0 top-0 z-0"
        width={RAIL_WIDTH}
        height={Math.max(height, 0)}
        viewBox={`0 0 ${RAIL_WIDTH} ${Math.max(height, 0)}`}
        fill="none"
        aria-hidden
      >
        <path
          d={path}
          stroke="#e0cba8"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="5 9"
        />
        {/* 停留点の印。降りる先が先に見えていると、下に続きがあることが分かる */}
        {stopYs.map((y, i) => (
          <circle
            key={i}
            cx={railX(y + AVATAR_SIZE / 2)}
            cy={y + AVATAR_SIZE / 2}
            r={i === standing ? 5 : 3.5}
            fill={i === standing ? '#7ED957' : '#e0cba8'}
          />
        ))}
      </svg>

      {/*
        道を歩いて降りてくるにちよさんと、その一言。
        位置は top/left ではなく transform（y / x）で動かす。top を毎フレーム
        書き換えるとそのたびにレイアウトが走り、スクロール中の測り直しと
        ぶつかって歩きがカクつく。transform なら合成だけで済み、小数の位置も出せる
      */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 will-change-transform"
        style={{ y: top, height: stopHeight }}
      >
        {/* 横は道の式から引く。くねりに沿って左右に振れながら降りてくる */}
        <motion.div className="absolute left-0 top-0 will-change-transform" style={{ x: avatarLeft }}>
          {/* 歩いているあいだ、一歩ごとに軽く弾む */}
          <motion.div
            animate={walking && !reduceMotion ? { y: [0, -WALK_BOB_PX, 0] } : { y: 0 }}
            transition={
              walking && !reduceMotion
                ? { duration: WALK_STEP_SEC, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          >
            <GrandmaAvatar pose={pose} size="pinned" character={DEFAULT_CONSULT_CHARACTER} />
          </motion.div>
        </motion.div>

        {/*
          言うことは、停留点に着いて止まってから出す。歩いている途中と、
          途中で止まっているときは何も言わない。歩き出すときに吹き出しをしまい、
          着いたところで出し直す。文字だけ差し替わると、まだ来ていない場所の
          話をしながら歩いて見える
        */}
        <div className="absolute top-0" style={{ left: RAIL_WIDTH + 4, right: 16 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!walking && standing !== null && (
              <motion.div
                key={standing}
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="consult-greeting consult-greeting--left rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm"
              >
                <p className="text-[14px] font-bold leading-6 text-amber-900">
                  {comments[standing] ?? comments[0]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
