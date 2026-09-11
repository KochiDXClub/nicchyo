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
 */

import { GUIDE_KIND_OPTIONS } from '../hooks/useOdekakeGuide';
import type { SpotKind } from '@/lib/spots';
import { X as XIcon } from 'lucide-react';

/** 何のためのものかを一言で。ラベルだけでは伝わらないので添える */
const KIND_NOTE: Record<string, string> = {
  restroom: 'お手洗いを探す',
  rest: '座れる場所を探す',
  transit: '電停・駅を探す',
  landmark: '目印になる場所',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2';

export default function OdekakeKindChooser({
  onSelect,
  onClose,
}: {
  onSelect: (kind: SpotKind) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[1650] flex items-center justify-center px-5"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 地図を暗くして、いま選ぶ場面だと分かるようにする */}
      <div className="absolute inset-0 bg-nicchyo-ink/45" onClick={onClose} aria-hidden />

      <div
        className="relative w-full max-w-[22rem] rounded-[28px] bg-white p-5 shadow-[0_16px_48px_rgba(58,58,58,0.3)]"
        role="dialog"
        aria-label="おでかけサポート"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="とじる"
          className={`${FOCUS_RING} absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 active:bg-slate-100`}
        >
          <XIcon size={18} />
        </button>

        <p className="pr-10 text-[19px] font-black leading-tight tracking-tight text-nicchyo-ink">
          なにかお探しですか？
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">
          いまいる場所から、近い順にご案内します。
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {GUIDE_KIND_OPTIONS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => onSelect(option.kind)}
              className={`${FOCUS_RING} flex flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-4 transition-transform active:scale-[0.97] active:bg-amber-50`}
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {option.emoji}
              </span>
              <span className="mt-0.5 text-[15px] font-black leading-none text-nicchyo-ink">{option.label}</span>
              <span className="text-[11px] leading-none text-slate-400">{KIND_NOTE[option.kind] ?? ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
