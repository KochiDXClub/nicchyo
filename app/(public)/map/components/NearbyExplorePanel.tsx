'use client';

/**
 * NearbyExplorePanel
 *
 * 「このへん、なにがある？」ボタンをタップした直後に表示するボトムシート。
 * 決定論的な内容（字幕・ジャンル内訳バー・おすすめ店グリッド）を即座に見せ、
 * "AIの一言" だけが少し遅れてフェードインする（Google の AI Overview 方式）。
 *
 * 追い質問はシート内で完結する: 回答は会話としてシート下部に流れ込む
 * （AI相談モードへは遷移しない）。
 * AIが店舗を薦めた場合は onShopsRecommended でマップのピンを光らせる。
 *
 * UI は検索パネルと同系の、画面下端に張り付くドラッグ可能シート（1段）:
 * - 開いた時点で常に展開状態（画面の約80%。全画面にはしない）
 * - ハンドルを下にスワイプ → 閉じる
 * - 地図が動いたときは親側の move リスナーで自動的に閉じる
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useDragControls } from 'framer-motion';
import {
  CONSULT_CHARACTER_BY_ID,
  type ConsultCharacter,
} from '../../consult/data/consultCharacters';
import type { ConsultTurn } from '../../consult/types/consultConversation';
import { getOrCreateConsultVisitorKey } from '../../../../lib/consultVisitorKey';
import { stripShopIdsDirective } from '@/lib/grandma/consultUtils';
import type { NearbyViewportSummary } from '../utils/viewportSummary';
import type { NearbyRecommendationReason } from '../utils/nearbyRecommendations';

/** "AIの一言" がフェードインするまでの時間（考えている感の演出） */
const NOTE_REVEAL_DELAY_MS = 1400;

/** ジャンル内訳バーの色（積み上げバーと凡例で共通） */
const GENRE_COLORS: Record<string, string> = {
  '食材': '#7ED957',
  '食べ物': '#F59E0B',
  '道具・工具': '#64748B',
  '生活雑貨': '#38BDF8',
  '植物・苗': '#14B8A6',
  'アクセサリー': '#F472B6',
  '手作り・工芸': '#A78BFA',
};
const FALLBACK_GENRE_COLOR = '#94A3B8';

/** 選定理由の表示ラベル（なぜこの店が出ているかを説明する） */
const REASON_LABELS: Record<NearbyRecommendationReason, string> = {
  favorite: '❤️ お気に入り',
  interest: '好みに合いそう',
  discovery: 'あたらしい出会い',
};

const ASK_ERROR_MESSAGE =
  'うまく聞こえんかった…通信状況を確認してからもう一度試してみてね。';

export type NearbyRecommendedShop = {
  shopId: number;
  name: string;
  category?: string;
  imageUrl?: string;
  reason: NearbyRecommendationReason;
};

type NearbyChatMessage =
  | { role: 'user'; text: string }
  | {
      role: 'assistant';
      text: string;
      speakerId?: ConsultTurn['speakerId'];
      speakerName?: string;
      isError?: boolean;
    };

type AskPayload = {
  reply?: string;
  errorMessage?: string;
  turns?: ConsultTurn[];
  shopIds?: number[];
};

/** シートの高さ＝画面の約80%（全画面にはしない） */
function getSheetHeight() {
  if (typeof window === 'undefined') {
    return 580;
  }
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Math.round(viewportHeight * 0.8);
}

function CharacterAvatar({ character }: { character: ConsultCharacter }) {
  return (
    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-amber-200 bg-[#fff6e5]">
      <Image
        src={character.image}
        alt={character.name}
        width={32}
        height={32}
        className={`h-full w-full object-cover ${character.imageScale}`}
        style={{ objectPosition: character.imagePosition }}
        draggable={false}
      />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5" aria-label="考え中">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-amber-400"
          style={{
            animation: `dot-pulse 0.75s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function NearbyExplorePanel({
  summary,
  recommendations,
  note,
  center,
  onSelectShop,
  onShopsRecommended,
  onClose,
}: {
  summary: NearbyViewportSummary;
  /** 行動シグナルから選んだ、範囲内のおすすめ店（最大9店） */
  recommendations: NearbyRecommendedShop[];
  /** 遅れてフェードインする"AIの一言" */
  note: string;
  /** 「このへん」の中心座標。追い質問の位置コンテキストとして送る */
  center: { lat: number; lng: number };
  onSelectShop: (shopId: number) => void;
  /** AIが店舗を薦めたときにマップのピンを光らせる */
  onShopsRecommended: (shopIds: number[]) => void;
  /** ハンドルを下にスワイプしたときに閉じる */
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [noteVisible, setNoteVisible] = useState(false);
  const [thread, setThread] = useState<NearbyChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const hasShops = summary.totalCount > 0;
  const [sheetHeight] = useState(getSheetHeight);
  const dragControls = useDragControls();
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const areaLabel =
    summary.chomeLabels.length > 0
      ? `${summary.chomeLabels.join('・')}のあたり`
      : 'このあたり';
  const noteCharacter = CONSULT_CHARACTER_BY_ID.get('nichiyosan');

  useEffect(() => {
    const timer = setTimeout(() => setNoteVisible(true), NOTE_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // 会話が伸びたら最下部へスクロール
  useEffect(() => {
    if (thread.length === 0) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [thread, asking]);

  const handleSubmit = async () => {
    const text = question.trim();
    if (!text || asking) return;

    setQuestion('');
    setAsking(true);
    const nextThread: NearbyChatMessage[] = [...thread, { role: 'user', text }];
    setThread(nextThread);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/grandma/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          location: center,
          history: nextThread
            .map((message) =>
              message.role === 'assistant'
                ? {
                    role: message.role,
                    text: message.text,
                    speakerId: message.speakerId,
                    speakerName: message.speakerName,
                  }
                : { role: message.role, text: message.text }
            )
            .slice(-6),
          visitorKey: getOrCreateConsultVisitorKey(),
          stream: false,
        }),
        signal: controller.signal,
      });

      const payload = (await res.json().catch(() => null)) as AskPayload | null;
      const turns = (payload?.turns ?? []).filter(
        (turn): turn is ConsultTurn =>
          !!turn && typeof turn.text === 'string' && turn.text.trim().length > 0
      );

      if (!res.ok) {
        setThread((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: payload?.reply ?? payload?.errorMessage ?? ASK_ERROR_MESSAGE,
            isError: true,
          },
        ]);
        return;
      }

      const assistantMessages: NearbyChatMessage[] = (
        turns.length > 0
          ? turns.map((turn) => ({
              role: 'assistant' as const,
              text: stripShopIdsDirective(turn.text),
              speakerId: turn.speakerId,
              speakerName: turn.speakerName,
            }))
          : [
              {
                role: 'assistant' as const,
                text: stripShopIdsDirective(payload?.reply ?? ''),
              },
            ]
      ).filter((message) => message.text.length > 0);

      setThread((prev) => [
        ...prev,
        ...(assistantMessages.length > 0
          ? assistantMessages
          : [{ role: 'assistant' as const, text: ASK_ERROR_MESSAGE, isError: true }]),
      ]);

      if (payload?.shopIds && payload.shopIds.length > 0) {
        onShopsRecommended(payload.shopIds);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setThread((prev) => [
        ...prev,
        { role: 'assistant', text: ASK_ERROR_MESSAGE, isError: true },
      ]);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setAsking(false);
      }
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1300]">
      <motion.div
        className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-amber-200 bg-white shadow-[0_-24px_60px_rgba(15,23,42,0.2)]"
        style={{ height: sheetHeight }}
        initial={{ opacity: 0, y: 48 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 56 || info.velocity.y > 500) {
            onClose();
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div
          className="flex shrink-0 cursor-grab justify-center pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
          style={{ touchAction: 'none' }}
          aria-label="下にスワイプで閉じる"
        >
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* 縦スクロール領域 */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-5 pt-1"
        >
          {/* 字幕1行 + ジャンル内訳バー */}
          <div>
            <p className="text-[15px] font-bold leading-tight text-slate-900">
              {hasShops ? (
                <>
                  {areaLabel}に{' '}
                  <span className="text-amber-700">{summary.totalCount}店</span>
                </>
              ) : (
                `${areaLabel}にはお店が見当たりません`
              )}
            </p>
            {hasShops && (
              <>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  {summary.genres.map((genre) => (
                    <div
                      key={genre.category}
                      style={{
                        width: `${(genre.count / summary.totalCount) * 100}%`,
                        backgroundColor:
                          GENRE_COLORS[genre.category] ?? FALLBACK_GENRE_COLOR,
                      }}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
                  {summary.genres.slice(0, 4).map((genre) => (
                    <span
                      key={genre.category}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            GENRE_COLORS[genre.category] ?? FALLBACK_GENRE_COLOR,
                        }}
                      />
                      {genre.category} {genre.count}
                    </span>
                  ))}
                  {summary.genres.length > 4 && (
                    <span className="text-[11px] font-medium text-slate-400">
                      ほか{summary.genres.length - 4}ジャンル
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* AIの一言（遅れてフェードイン） */}
          <div className="flex min-h-[44px] items-start gap-2.5">
            {noteCharacter && <CharacterAvatar character={noteCharacter} />}
            {noteVisible ? (
              <p className="animate-in fade-in slide-in-from-bottom-1 pt-1 text-[13px] font-medium leading-relaxed text-slate-700 duration-500">
                {note}
              </p>
            ) : (
              <div className="pt-2.5">
                <ThinkingDots />
              </div>
            )}
          </div>

          {/* おすすめ店グリッド（3列×最大3行・理由付き） */}
          {recommendations.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                このへんのおすすめ
              </p>
              <div className="grid grid-cols-3 gap-3">
                {recommendations.map((entry) => (
                  <button
                    key={entry.shopId}
                    type="button"
                    onClick={() => onSelectShop(entry.shopId)}
                    className="w-full text-left transition-transform active:scale-95"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                      {entry.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.imageUrl}
                          alt={entry.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          draggable={false}
                        />
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] font-bold leading-tight text-slate-800">
                      {entry.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {REASON_LABELS[entry.reason]}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 追い質問の会話（シート内で完結） */}
          {(thread.length > 0 || asking) && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {thread.map((message, index) => {
                if (message.role === 'user') {
                  return (
                    <div key={index} className="flex justify-end">
                      <p className="max-w-[80%] rounded-2xl rounded-br-md bg-amber-500 px-3.5 py-2 text-[13px] font-medium leading-relaxed text-white">
                        {message.text}
                      </p>
                    </div>
                  );
                }
                const character =
                  (message.speakerId
                    ? CONSULT_CHARACTER_BY_ID.get(message.speakerId)
                    : undefined) ?? noteCharacter;
                return (
                  <div key={index} className="flex items-start gap-2.5">
                    {character && <CharacterAvatar character={character} />}
                    <div className="min-w-0 max-w-[80%]">
                      <p
                        className={`rounded-2xl rounded-tl-md px-3.5 py-2 text-[13px] font-medium leading-relaxed ${
                          message.isError
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {message.text}
                      </p>
                      {(message.speakerName || character) && (
                        <p className="mt-1 pl-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">
                          {message.speakerName ?? character?.name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {asking && (
                <div className="flex items-start gap-2.5">
                  {noteCharacter && <CharacterAvatar character={noteCharacter} />}
                  <div className="rounded-2xl rounded-tl-md bg-slate-100 px-3.5 py-3">
                    <ThinkingDots />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 追い質問バー（下部固定） */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="このへんのことをAIに聞く…"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!question.trim() || asking}
              aria-label="AIに聞く"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[13px] font-bold text-white shadow-pop transition-all hover:bg-amber-600 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none"
            >
              ↑
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
