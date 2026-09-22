'use client';

/**
 * 「にちよさんに聞く」のデモ。
 *
 * 吹き出し・アバター・打っている最中の三点は AiConsultPanel と同じ形にしてある。
 * ただし答えは決め打ちで、AI は呼ばない。案内を開いただけで API を叩かないためと、
 * 初めての人に「こういうやり取りになる」形だけ先に見せたいため。
 * 決め打ちであることは画面にも書いておく。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { ChevronRight } from 'lucide-react';

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

type Message = { role: 'user' | 'grandma'; text: string };

export default function IntroConsultDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const timersRef = useRef<number[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    []
  );

  // 新しい発言が入ったら下まで送る（本番のチャットと同じ）
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const ask = useCallback((exchange: Exchange) => {
    if (typing) return;
    setAsked((prev) => [...prev, exchange.question]);
    setMessages((prev) => [...prev, { role: 'user', text: exchange.question }]);
    setTyping(true);
    const id = window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, { role: 'grandma', text: exchange.answer }]);
    }, 900);
    timersRef.current.push(id);
  }, [typing]);

  const remaining = EXCHANGES.filter((e) => !asked.includes(e.question));

  return (
    <div className="overflow-hidden rounded-2xl bg-white/80 ring-1 ring-nicchyo-ink/10">
      <div
        ref={scrollRef}
        className="max-h-[210px] min-h-[132px] space-y-2.5 overflow-y-auto px-3.5 py-3"
      >
        {messages.length === 0 && !typing && (
          <div className="flex flex-col items-center gap-2 py-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-nicchyo-accent/25">
              <NextImage
                src="/images/obaasan_transparent.png"
                alt="にちよさん"
                width={40}
                height={40}
                className="h-10 w-10"
              />
            </span>
            <p className="text-[13px] font-bold text-nicchyo-ink">
              日曜市のことなら何でも聞いてね
            </p>
            <p className="text-[11px] text-nicchyo-ink/45">土佐弁で親切にお答えするがよ〜</p>
          </div>
        )}

        {messages.map((message, i) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={`${message.role}-${i}`}
              className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isUser && (
                <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nicchyo-accent/25">
                  <NextImage
                    src="/images/obaasan_transparent.png"
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5"
                  />
                </span>
              )}
              <span
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                  isUser
                    ? 'rounded-br-sm bg-slate-900 text-white'
                    : 'rounded-bl-sm border border-amber-200 bg-amber-50 text-slate-800'
                }`}
              >
                {message.text}
              </span>
            </div>
          );
        })}

        {typing && (
          <div className="flex items-end gap-2">
            <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-nicchyo-accent/25">
              <NextImage
                src="/images/obaasan_transparent.png"
                alt=""
                width={20}
                height={20}
                className="h-5 w-5"
              />
            </span>
            <span className="rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
              <span className="inline-flex items-center gap-1" aria-label="にちよさんが入力中">
                {[0, 160, 320].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-500/70"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </span>
          </div>
        )}
      </div>

      {remaining.length > 0 && (
        <div className="space-y-1.5 border-t border-nicchyo-ink/[0.07] bg-white/60 px-3.5 py-3">
          {remaining.map((exchange) => (
            <button
              key={exchange.question}
              type="button"
              onClick={() => ask(exchange)}
              disabled={typing}
              className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-amber-900 transition active:scale-[0.98] disabled:opacity-50"
            >
              <span className="flex-1">{exchange.question}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
            </button>
          ))}
        </div>
      )}

      <p className="border-t border-nicchyo-ink/[0.07] px-3.5 py-2 text-center text-[10.5px] leading-relaxed text-nicchyo-ink/40">
        ここは見本の受け答えです。実際のにちよさんは、その日のお店の情報をもとに答えます
      </p>
    </div>
  );
}
