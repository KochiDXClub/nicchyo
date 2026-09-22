'use client';

/**
 * 案内パネルを縦に貫く、にちよさんの道。
 *
 * 案内の中でにちよさんの絵は1枚だけにして、スクロールに合わせてその1枚が
 * 上から下へ降りてくる。停留点は各見出しのすぐ下で、着いたところで一言しゃべる。
 * 絵を節ごとに置くと「何人もいる」ことになり、案内していた人がいなくなる。
 *
 * 道は静かな波線で常に描いておく。降りる先が見えていると、下にまだ続きがあることが
 * 読む前に分かる。デモの枠は不透明なので、その裏は通り抜けているように見える。
 *
 * 絵は相談ページと同じ GrandmaAvatar（構えが変わると会釈する）、吹き出しも
 * 相談ページと同じもの（.consult-greeting）を、尻尾だけ左向きにして使う。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
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
/** 歩く速さ（px/秒）。速いと飛んでいるように見えるので、人が歩くくらいに落とす */
const WALK_SPEED_PX_PER_SEC = 420;
const WALK_MIN_SEC = 0.8;
const WALK_MAX_SEC = 1.9;
/**
 * これより小さなずれは歩かずに立ち位置を直す。
 * 停留点は測り直しで数 px 動くことがあり、そのたびに 0.8 秒歩いて
 * 吹き出しをしまっていては落ち着かない
 */
const SNAP_PX = 12;
/** 一歩ぶんの上下。踏み出すたびに軽く弾む */
const WALK_BOB_PX = 4;
const WALK_STEP_SEC = 0.46;

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
  targetStop,
  comments,
  stopHeight = RAIL_STOP_HEIGHT,
}: {
  /** 道を引く高さ（案内の中身の高さ） */
  height: number;
  /** 各停留点の上端。中身の先頭からの px */
  stopYs: number[];
  /** 読んでいる場所から決まる、向かう先の停留点 */
  targetStop: number;
  /** 停留点ごとに言うこと */
  comments: readonly string[];
  /** 停留点1つぶんの高さ */
  stopHeight?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [pose, setPose] = useState<GrandmaPose>('idle');
  const [walking, setWalking] = useState(false);

  /**
   * 向かう先へはまっすぐ歩く。途中の停留点で足を止めることはしない。
   * スクロールのほうが節の先頭で必ず一度止まる（scroll-snap）ので、
   * 向かう先はふつう隣の停留点で、飛ばして見えることはない
   */
  const stopY = stopYs[targetStop] ?? 0;

  /**
   * 縦の位置。これを動かすと、横の位置は道の式から引き直される。
   *
   * 以前は縦だけを動かして横は着いた先の値をそのまま入れていたので、
   * 歩き出した瞬間に横へ瞬間移動していた。道がくねっているぶん、
   * それが「宙を飛んでいる」ように見えていた。
   */
  const top = useMotionValue(stopY);
  const avatarLeft = useTransform(top, (y) => railX(y + AVATAR_SIZE / 2) - AVATAR_SIZE / 2);

  /** 停留点の位置を一度でも測れたか。測れる前の 0 からは歩かず、立ち位置だけ直す */
  const hasMeasuredRef = useRef(false);

  useEffect(() => {
    if (stopYs.length === 0) return;
    const distance = Math.abs(stopY - top.get());
    // 開いた直後（まだ 0 に居る）と、測り直しの小さなずれは歩かない
    if (!hasMeasuredRef.current || distance < SNAP_PX || reduceMotion) {
      hasMeasuredRef.current = true;
      top.set(stopY);
      return;
    }
    setWalking(true);
    const controls = animate(top, stopY, {
      // 距離なりに時間をかける。遠いところへ一瞬で着くと歩いて見えない
      duration: Math.min(WALK_MAX_SEC, Math.max(WALK_MIN_SEC, distance / WALK_SPEED_PX_PER_SEC)),
      ease: [0.33, 0, 0.25, 1],
      onComplete: () => setWalking(false),
    });
    return () => {
      controls.stop();
      setWalking(false);
    };
  }, [stopY, stopYs.length, reduceMotion, top]);

  // 歩いているあいだは前を見て、着いたらしばらく話している顔にする
  useEffect(() => {
    if (walking) {
      setPose('idle');
      return;
    }
    setPose('speaking');
    const timer = window.setTimeout(() => setPose('idle'), SPEAK_MS);
    return () => window.clearTimeout(timer);
  }, [walking, targetStop]);

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
            r={i === targetStop ? 5 : 3.5}
            fill={i === targetStop ? '#7ED957' : '#e0cba8'}
          />
        ))}
      </svg>

      {/* 道を歩いて降りてくるにちよさんと、その一言 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 z-10"
        style={{ top, height: stopHeight }}
      >
        {/* 横は道の式から引く。くねりに沿って左右に振れながら降りてくる */}
        <motion.div className="absolute top-0" style={{ left: avatarLeft }}>
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
          言うことは、着いてから出す。歩いている途中は何も言わない。
          歩き出すときに吹き出しをしまい、着いたところで出し直す。
          文字だけ差し替わると、まだ来ていない場所の話をしながら歩いて見える
        */}
        <div className="absolute top-0" style={{ left: RAIL_WIDTH + 4, right: 16 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!walking && (
              <motion.div
                key={targetStop}
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="consult-greeting consult-greeting--left rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm"
              >
                <p className="text-[14px] font-bold leading-6 text-amber-900">
                  {comments[targetStop] ?? comments[0]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
