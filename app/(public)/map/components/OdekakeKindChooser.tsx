'use client';

/**
 * OdekakeKindChooser
 *
 * おでかけサポートを開いた直後、まだ何を探すか決まっていないときに出す選択画面。
 *
 * 以前は画面の下に高さ134pxの帯が出て、その中に小さなチップが横に並ぶだけだった。
 * 4つ目が画面の外にはみ出しており、初めての人には「何ができるのか」も
 * 「いくつ選べるのか」も分からない。画面の残り84%は地図のままで、
 * いま何を求められているのかが伝わらなかった。
 *
 * そこで、種類が決まるまでは画面の中央に出し、4つを大きな面として並べる。
 * ひとつ選べば従来のボトムシート（近い順の一覧）に切り替わる。
 *
 * アイコンは /facilities（おでかけサポートのページ）と地図のマーカーで使っている
 * ものをそのまま使い、絵文字は使わない。配色は nicchyo のパレットに合わせる。
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Landmark as LandmarkIcon, X as XIcon } from 'lucide-react';
import { GUIDE_KIND_OPTIONS } from '../hooks/useOdekakeGuide';
import type { SpotKind } from '@/lib/spots';

/** /facilities と地図で使っているアイコン。目印だけは専用画像が無いので線画で代える */
const KIND_ICON_URL: Partial<Record<SpotKind, string>> = {
  restroom: '/images/maps/elements/facilities/restroom.svg',
  rest: '/images/maps/elements/facilities/rest.svg',
  transit: '/images/maps/elements/transit/tram-stop.svg',
};

/** 何のためのものかを一言で。ラベルだけでは伝わらないので添える */
const KIND_NOTE: Partial<Record<SpotKind, string>> = {
  restroom: 'お手洗いを探す',
  rest: '座れる場所を探す',
  transit: '電停・駅を探す',
  landmark: '目印になる場所',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nicchyo-primary focus-visible:ring-offset-2';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function KindIcon({ kind }: { kind: SpotKind }) {
  const url = KIND_ICON_URL[kind];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-9 w-9 object-contain drop-shadow-sm" draggable={false} />
    );
  }
  return <LandmarkIcon size={30} strokeWidth={2.2} className="text-nicchyo-ink" aria-hidden />;
}

export default function OdekakeKindChooser({
  onSelect,
  onClose,
}: {
  onSelect: (kind: SpotKind) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[1650] flex items-center justify-center px-5"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 地図を落として、いま選ぶ場面だと分かるようにする */}
      <motion.div
        className="absolute inset-0 bg-nicchyo-ink/45"
        onClick={onClose}
        aria-hidden
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        className="relative w-full max-w-[22rem] rounded-[28px] bg-nicchyo-base p-5 shadow-[0_20px_56px_rgba(58,58,58,0.32)] ring-1 ring-nicchyo-ink/5"
        role="dialog"
        aria-label="おでかけサポート"
        aria-modal="true"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="とじる"
          className={`${FOCUS_RING} absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-nicchyo-ink/50 transition-colors active:bg-nicchyo-ink/10`}
        >
          <XIcon size={18} />
        </button>

        <p className="pr-10 text-[19px] font-black leading-tight tracking-tight text-nicchyo-ink">
          なにかお探しですか？
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-nicchyo-ink/60">
          いまいる場所から、近い順にご案内します。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {GUIDE_KIND_OPTIONS.map((option, i) => (
            <motion.button
              key={option.kind}
              type="button"
              onClick={() => onSelect(option.kind)}
              className={`${FOCUS_RING} flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-nicchyo-soft-green/70 bg-white px-3 py-4 text-nicchyo-ink`}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: reduceMotion ? 0 : 0.08 + i * 0.06 }}
              // 押した手応え：少し沈んで黄色（nicchyo-accent）に染まる
              whileTap={
                reduceMotion
                  ? undefined
                  : { scale: 0.94, backgroundColor: '#FFDE59', borderColor: '#FFDE59' }
              }
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-nicchyo-soft-green/30" aria-hidden>
                <KindIcon kind={option.kind} />
              </span>
              <span className="mt-0.5 text-[15px] font-black leading-none">{option.label}</span>
              <span className="text-[11px] leading-none text-nicchyo-ink/55">{KIND_NOTE[option.kind] ?? ''}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
