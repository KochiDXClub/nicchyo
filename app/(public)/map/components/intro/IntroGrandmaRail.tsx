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
/** 先にまだ停留点が控えているときの速さ。急ぎ足だが、走ってはいない */
const HURRY_SPEED_PX_PER_SEC = 640;
const WALK_MIN_SEC = 0.8;
const WALK_MAX_SEC = 1.9;
/**
 * 途中の停留点で足を止めている時間。
 * 一気に下まで送られても、見出しごとに必ず一度止まって一言言う。
 * 飛ばして着くと「どこを案内していたのか」が抜け落ちる
 */
const DWELL_MS = 650;
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
   * いま立っている（または向かっている）停留点。
   *
   * 向かう先（targetStop）へ一気には行かず、間の停留点を一つずつ経由する。
   * 勢いよく下まで送られても、見出しごとに必ず一度止まって一言言ってから
   * 次へ歩く。飛ばすと「どこを案内していたのか」が抜け落ちるし、
   * 止まらずに通り過ぎるのは案内している人の動きではない
   */
  const [current, setCurrent] = useState(targetStop);
  const stopY = stopYs[current] ?? 0;
  const pendingLegs = Math.abs(targetStop - current);

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
  /**
   * 歩いている最中か（state の walking と同じ内容を同期で持つ）。
   * 次の停留点へ進める判定は同じ描画の中で走るので、state の値だと
   * まだ歩き出していないように見えて、もう一段進めてしまう
   */
  const walkingRef = useRef(false);
  /**
   * いま立っている停留点に「着いたばかり」か。
   * 途中の停留点では一言言うぶんだけ足を止めるが、読む人がスクロールして
   * 歩き出すときは待たない。立っているところで待たされると、動き出しが遅く見える
   */
  const justArrivedRef = useRef(false);

  useEffect(() => {
    if (stopYs.length === 0) return;
    const distance = Math.abs(stopY - top.get());
    // 開いた直後（まだ 0 に居る）と、測り直しの小さなずれは歩かない
    if (!hasMeasuredRef.current || distance < SNAP_PX || reduceMotion) {
      hasMeasuredRef.current = true;
      top.set(stopY);
      return;
    }
    walkingRef.current = true;
    setWalking(true);
    const speed = pendingLegs > 0 ? HURRY_SPEED_PX_PER_SEC : WALK_SPEED_PX_PER_SEC;
    const controls = animate(top, stopY, {
      // 距離なりに時間をかける。遠いところへ一瞬で着くと歩いて見えない
      duration: Math.min(WALK_MAX_SEC, Math.max(WALK_MIN_SEC, distance / speed)),
      ease: [0.33, 0, 0.25, 1],
      onComplete: () => {
        walkingRef.current = false;
        justArrivedRef.current = true;
        setWalking(false);
      },
    });
    return () => {
      controls.stop();
      walkingRef.current = false;
      setWalking(false);
    };
    // pendingLegs は速さの目安にだけ使う。目的地が変わらないのに歩き直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopY, stopYs.length, reduceMotion, top]);

  // まだ先があれば次の停留点へ。着いたばかりなら一言ぶん間を置き、
  // 読む人が動かして歩き出すときはすぐ発つ
  useEffect(() => {
    if (walkingRef.current || walking || pendingLegs === 0) return;
    const step = () => {
      justArrivedRef.current = false;
      setCurrent((c) => c + Math.sign(targetStop - c));
    };
    if (!justArrivedRef.current || reduceMotion) {
      step();
      return;
    }
    const timer = window.setTimeout(step, DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [walking, pendingLegs, targetStop, reduceMotion]);

  // 歩いているあいだは前を見て、着いたらしばらく話している顔にする
  useEffect(() => {
    if (walking) {
      setPose('idle');
      return;
    }
    setPose('speaking');
    const timer = window.setTimeout(() => setPose('idle'), SPEAK_MS);
    return () => window.clearTimeout(timer);
  }, [walking, current]);

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
            r={i === current ? 5 : 3.5}
            fill={i === current ? '#7ED957' : '#e0cba8'}
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
                key={current}
                initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                className="consult-greeting consult-greeting--left rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm"
              >
                <p className="text-[14px] font-bold leading-6 text-amber-900">
                  {comments[current] ?? comments[0]}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
