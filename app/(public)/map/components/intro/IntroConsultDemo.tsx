'use client';

/**
 * 「にちよさんに聞く」のデモ。
 *
 * 相談ページ（ConsultStage）の画面をそのまま縮めたもの。
 *   大きなにちよさん → 最初のひとこと → 質問の候補ボタン → 答えのカード1枚
 * キャラ絵は相談ページと同じ GrandmaAvatar（構えが変わるとうなずく）を呼び、
 * 答えのカード・候補ボタン・考え中の骨組みも相談ページと同じ形にしてある。
 * チャットの吹き出しが並ぶ画面ではないので、ここも1枚だけ出す。
 *
 * 違うのは、答えが決め打ちで AI を呼ばないところ。案内を開いただけで
 * AI が動かないようにするため。見本であることは画面にも書いてある。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import GrandmaAvatar from '../../../consult/components/GrandmaAvatar';
import { DEFAULT_CONSULT_CHARACTER } from '../../../consult/data/consultCharacters';
import type { GrandmaPose } from '@/lib/grandma/pose';

type Exchange = { question: string; answer: string };

/** 実際によく聞かれる形に寄せた見本。答えは案内用の決め打ち */
const EXCHANGES: Exchange[] = [
  {
    question: 'おすすめのランチは？',
    answer:
      '歩きながら食べるなら芋天がええよ。揚げたてを紙袋で渡してくれるき、そのまま次の店へ行けるがよ。',
  },
  {
    question: 'はじめてでも大丈夫？',
    answer:
      'もちろん。まずは真ん中の通路をまっすぐ歩いてみて。気になった店で足を止めたらええき。',
  },
  {
    question: 'お手洗いはどこ？',
    answer: '追手筋沿いに何か所かあるよ。「おでかけ」を押したら、近いところまで案内するきね。',
  },
];

/** 考えている時間。相談ページで実際に待つくらいの長さにする */
const THINKING_MS = 900;

export default function IntroConsultDemo() {
  const [asked, setAsked] = useState<Exchange | null>(null);
  const [thinking, setThinking] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const ask = useCallback((exchange: Exchange) => {
    if (thinking) return;
    setAsked(exchange);
    setThinking(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setThinking(false);
    }, THINKING_MS);
  }, [thinking]);

  // 相談ページと同じ導き方（考えている → 答えている → 待機）
  const pose: GrandmaPose = thinking ? 'thinking' : asked ? 'speaking' : 'idle';
  const showAnswer = asked !== null;
  const remaining = EXCHANGES.filter((e) => e.question !== asked?.question);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/85 px-4 py-5 ring-1 ring-nicchyo-ink/10">
      {/* 主役のにちよさん。相談ページと同じ絵・同じ構えの動き */}
      <div className="flex flex-col items-center gap-2">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />

        {!showAnswer && (
          <div className="consult-greeting max-w-[19rem] rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-center shadow-sm">
            <p className="text-[15px] font-bold leading-6 text-amber-900">
              この通りのことなら、なんでも聞いてや。
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700/80">
              聞きたいことを選んでね
            </p>
          </div>
        )}
      </div>

      {/* 今の答え。相談ページと同じで、並べずに1枚だけ出す */}
      {showAnswer && (
        <div className="rounded-3xl border border-amber-100 bg-white/90 p-4 shadow-sm">
          <p className="truncate text-xs text-slate-400">{asked.question}</p>
          <p className="mt-1 text-[11px] font-bold text-amber-700">
            {DEFAULT_CONSULT_CHARACTER.name}
          </p>
          {thinking ? (
            <div className="mt-3 flex flex-col gap-2" aria-live="polite" aria-label="考え中">
              <span className="consult-skeleton h-3.5 w-4/5 rounded-full" />
              <span
                className="consult-skeleton h-3.5 w-full rounded-full"
                style={{ animationDelay: '120ms' }}
              />
              <span
                className="consult-skeleton h-3.5 w-3/5 rounded-full"
                style={{ animationDelay: '240ms' }}
              />
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {asked.answer}
            </p>
          )}
        </div>
      )}

      {/* 候補ボタン。相談ページではここが主役なので、同じ大きさ・同じ見た目にする */}
      {!thinking && remaining.length > 0 && (
        <div className="flex flex-col gap-2">
          {remaining.map((exchange) => (
            <button
              key={exchange.question}
              type="button"
              onClick={() => ask(exchange)}
              className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-4 text-left text-base font-bold text-amber-900 shadow-sm transition active:scale-[0.98]"
            >
              {exchange.question}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[10.5px] leading-relaxed text-nicchyo-ink/40">
        ここは見本の受け答えです。実際のにちよさんは、その日のお店の情報をもとに答えます
      </p>
    </div>
  );
}
