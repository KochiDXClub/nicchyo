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

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
export const RAIL_STOP_HEIGHT = 84;
export const RAIL_STOP_HEIGHT_DESKTOP = 72;

const RAIL_CENTER_X = 34;
const WAVE_AMPLITUDE = 11;
const WAVE_LENGTH = 220;
const AVATAR_SIZE = 64;
/** 着いてからしゃべっている時間 */
const SPEAK_MS = 2200;

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
  activeStop,
  comment,
  stopHeight = RAIL_STOP_HEIGHT,
}: {
  /** 道を引く高さ（案内の中身の高さ） */
  height: number;
  /** 各停留点の上端。中身の先頭からの px */
  stopYs: number[];
  activeStop: number;
  /** いま立っているところで言うこと */
  comment: string;
  /** 停留点1つぶんの高さ */
  stopHeight?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [pose, setPose] = useState<GrandmaPose>('idle');

  // 着いたらしばらく話している顔にする（会釈する）
  useEffect(() => {
    setPose('speaking');
    const timer = window.setTimeout(() => setPose('idle'), SPEAK_MS);
    return () => window.clearTimeout(timer);
  }, [activeStop]);

  const path = useMemo(() => buildRailPath(height), [height]);
  const stopY = stopYs[activeStop] ?? 0;

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
            r={i === activeStop ? 5 : 3.5}
            fill={i === activeStop ? '#7ED957' : '#e0cba8'}
          />
        ))}
      </svg>

      {/* 降りてくるにちよさんと、その一言 */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 z-10"
        initial={false}
        animate={{ top: stopY }}
        // 停留点の間が遠いこともあるので、ばねは硬めにして早く落ち着かせる。
        // ゆるいと、読み始めてもまだ滑っている最中ということが起きる
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30, mass: 0.7 }
        }
        style={{ height: stopHeight }}
      >
        {/* 道の上を跳ねながら移動する。止まるたびに一度だけ弾む */}
        <motion.div
          key={reduceMotion ? 'static' : activeStop}
          className="absolute top-0"
          style={{ left: railX(stopY) - AVATAR_SIZE / 2 }}
          animate={reduceMotion ? undefined : { y: [0, -13, 0, -6, 0] }}
          transition={{ duration: 0.62, times: [0, 0.28, 0.55, 0.8, 1], ease: 'easeOut' }}
        >
          <GrandmaAvatar pose={pose} size="pinned" character={DEFAULT_CONSULT_CHARACTER} />
        </motion.div>

        <div
          className="absolute top-0"
          style={{ left: RAIL_WIDTH + 4, right: 16 }}
        >
          <div className="consult-greeting consult-greeting--left rounded-2xl border border-amber-200 bg-white px-4 py-2.5 shadow-sm">
            {/* 文字だけ差し替わるとぱっと変わって見えるので、ここだけ短く溶かす */}
            <motion.p
              key={activeStop}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: reduceMotion ? 0 : 0.12 }}
              className="text-[14px] font-bold leading-6 text-amber-900"
            >
              {comment}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
