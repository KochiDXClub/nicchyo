'use client';

/**
 * MapCharacterConsult
 *
 * マップ上で AI と会話するコンポーネント。
 *
 * UX:
 * - キャラクターは入力バー直上の左端に固定表示
 * - 回答は非ストリーミングで、全体が揃ってから再生
 * - 2人のキャラクターが4秒ごとに交代しながら話す
 * - 紹介店舗があれば、同じ4秒周期で1店舗ずつフォーカスする
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap } from 'leaflet';
import { Textarea } from '@/components/ui/textarea';
import { PromptSuggestion } from '@/components/ui/prompt-suggestion';
import {
  CONSULT_CHARACTER_BY_ID,
  pickConsultCharacters,
  type ConsultCharacter,
} from '../../consult/data/consultCharacters';
import type { ConsultAskResponse, ConsultTurn } from '../../consult/types/consultConversation';
import type { Shop } from '../data/shops';
import { getOrCreateConsultVisitorKey } from '../../../../lib/consultVisitorKey';
import { toggleFavoriteShopId, loadFavoriteShopIds } from '../../../../lib/favoriteShops';

const PLAN_KEY = 'nicchyo-map-agent-plan';
// /consult ページ（GrandmaChatter, layout="page"）が会話履歴を保存する localStorage キー。
// フルチャットへ引き継ぐ際は、ここへマップ上の会話を書き込んでから遷移する。
const CONSULT_CHAT_STORAGE_KEY = 'nicchyo-consult-chat';

type PlanShop = { id: number; name: string; reason: string; icon: string };
type StoredPlan = { plan: { title: string; summary: string; shops: PlanShop[]; routeHint: string; shoppingList: string[] }; order: number[] };

const RESPONSE_STEP_MS = 4000;
const CHAR_W = 60;
const CHAR_H = 96;
const INPUT_MIN_HEIGHT = 58;
const INPUT_MAX_HEIGHT = 140;

type Status = 'idle' | 'loading' | 'playing' | 'error';

type CharacterBubbleState = {
  text: string | null;
  isThinking: boolean;
  isError: boolean;
};

type AskPayload = {
  reply?: string;
  errorMessage?: string;
  turns?: ConsultAskResponse['turns'];
  shopIds?: number[];
  consultId?: string;
};

function CharacterSprite({
  character,
  text,
  isThinking,
  isError,
}: {
  character: ConsultCharacter;
  text: string | null;
  isThinking: boolean;
  isError?: boolean;
}) {
  const showBubble = isThinking || !!text;

  return (
    <div className="pointer-events-none relative" style={{ width: CHAR_W }}>
      {showBubble && (
        <div className="absolute bottom-full left-0 mb-3 w-72 max-w-[calc(100vw-2rem)]">
          <div
            className={`relative rounded-[22px] border px-4 py-3 shadow-[0_20px_40px_rgba(15,23,42,0.16)] transition-colors duration-300 ${
              isError
                ? 'border-red-200 bg-red-50'
                : 'border-amber-200 bg-[#fff9ef]'
            }`}
          >
            {isThinking ? (
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-2.5 w-2.5 rounded-full bg-amber-500"
                    style={{ animation: `dot-pulse 0.75s ease-in-out ${i * 0.18}s infinite` }}
                  />
                ))}
              </div>
            ) : (
              <p className={`text-[13px] font-medium leading-[1.5] ${isError ? 'text-red-700' : 'text-slate-900'}`}>
                {text}
              </p>
            )}
            <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.16em] ${isError ? 'text-red-500' : 'text-amber-700'}`}>
              {character.name}
            </p>
            <div
              className={`absolute -bottom-[7px] left-5 h-3.5 w-3.5 rotate-45 border-r border-b ${
                isError ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-[#fff9ef]'
              }`}
            />
          </div>
        </div>
      )}

      <div
        className="relative overflow-hidden"
        style={{ height: CHAR_H, width: CHAR_W, animation: 'character-idle 3s ease-in-out infinite' }}
      >
        <Image
          src={character.image}
          alt={character.name}
          width={CHAR_W}
          height={CHAR_H}
          className={`h-full w-full object-cover ${character.imageScale}`}
          style={{ objectPosition: character.imagePosition }}
          draggable={false}
        />
      </div>
      <div className="mx-auto mt-0.5 h-2 w-8 rounded-full bg-black/10 blur-sm" />
    </div>
  );
}

function getStatusLabel(status: Status, elapsed: number): string | null {
  if (status === 'loading') {
    if (elapsed < 2) return '相談を送信中…';
    if (elapsed < 5) return '考え中…';
    if (elapsed < 10) return 'もう少し待ってね…';
    return 'まだかかりそう、もうちょっとだけ！';
  }
  if (status === 'playing') return '案内中…';
  if (status === 'error') return 'もう一度試してね';
  return null;
}


// フルチャットへの導線を主にするため、初期サジェストは1件に絞る。
const STARTER_PROMPTS = ['おすすめのスイーツのお店は？'];

export default function MapCharacterConsult({
  map,
  shops,
  onShopsRecommended,
}: {
  map: LeafletMap | null;
  shops: Shop[];
  onShopsRecommended: (shopIds: number[]) => void;
}) {
  const router = useRouter();
  const [characters] = useState(() => pickConsultCharacters());
  const [activeCharacter, setActiveCharacter] = useState<ConsultCharacter | null>(null);
  const [bubble, setBubble] = useState<CharacterBubbleState>({
    text: null,
    isThinking: false,
    isError: false,
  });
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [lastConsultId, setLastConsultId] = useState<string | null>(null);
  const [lastQuestionText, setLastQuestionText] = useState<string | null>(null);
  const [lastTurnText, setLastTurnText] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [thumbsDownOpen, setThumbsDownOpen] = useState(false);
  const [thumbsDownComment, setThumbsDownComment] = useState('');
  const [recommendedShops, setRecommendedShops] = useState<Shop[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => new Set(loadFavoriteShopIds()));
  const [routeIds, setRouteIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (!raw) return new Set();
      const stored = JSON.parse(raw) as Partial<StoredPlan>;
      return new Set((stored.plan?.shops ?? []).map((s) => s.id));
    } catch {
      return new Set();
    }
  });

  const shopMap = useRef(new Map(shops.map((shop) => [shop.id, shop])));
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackSequenceRef = useRef(0);

  const isBusy = status === 'loading' || status === 'playing';
  const starterPrompts = STARTER_PROMPTS;
  const showIntroChrome = history.length === 0 && status === 'idle';

  const clearPlayback = useCallback(() => {
    playbackSequenceRef.current += 1;
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, []);

  const resolveCharacter = useCallback(
    (speakerId?: ConsultTurn['speakerId'] | null) => {
      if (speakerId) {
        const matchingSelected = characters.find((character) => character.id === speakerId);
        if (matchingSelected) return matchingSelected;
        const knownCharacter = CONSULT_CHARACTER_BY_ID.get(speakerId);
        if (knownCharacter) return knownCharacter;
      }
      return characters[0] ?? null;
    },
    [characters]
  );

  const focusShopById = useCallback(
    (shopId: number | null) => {
      if (!shopId || !map) return;
      const shop = shopMap.current.get(shopId);
      if (!shop) return;
      map.flyTo([shop.lat, shop.lng], map.getMaxZoom() ?? 19, {
        animate: true,
        duration: 0.9,
        easeLinearity: 0.25,
      });
    },
    [map]
  );

  const playResponseSequence = useCallback(
    (turns: ConsultTurn[], shopIds: number[], isError = false) => {
      clearPlayback();

      const fallbackCharacter = resolveCharacter(null);
      const normalizedTurns =
        turns.length > 0
          ? turns
          : fallbackCharacter
            ? [
                {
                  speakerId: fallbackCharacter.id,
                  speakerName: fallbackCharacter.name,
                  text: isError
                    ? 'うまく聞こえんかった…通信状況を確認してからもう一度試してみてね。'
                    : '',
                } satisfies ConsultTurn,
              ]
            : [];

      if (normalizedTurns.length === 0) {
        setStatus(isError ? 'error' : 'idle');
        return false;
      }

      const sequenceId = playbackSequenceRef.current;
      setStatus(isError ? 'error' : 'playing');

      const showStep = (index: number) => {
        if (playbackSequenceRef.current !== sequenceId) return;

        const turn = normalizedTurns[index];
        const character = resolveCharacter(turn.speakerId);
        if (character) {
          setActiveCharacter(character);
        }
        setBubble({
          text: turn.text,
          isThinking: false,
          isError,
        });

        if (shopIds.length > 0) {
          const shopId = shopIds[index % shopIds.length] ?? null;
          focusShopById(shopId);
        }

        if (index >= normalizedTurns.length - 1) {
          if (!isError) {
            playbackTimerRef.current = setTimeout(() => {
              if (playbackSequenceRef.current !== sequenceId) return;
              playbackTimerRef.current = null;
              setStatus('idle');
            }, RESPONSE_STEP_MS);
          }
          return;
        }

        playbackTimerRef.current = setTimeout(() => {
          showStep(index + 1);
        }, RESPONSE_STEP_MS);
      };

      showStep(0);
      return true;
    },
    [clearPlayback, focusShopById, resolveCharacter]
  );

  useEffect(() => {
    const firstCharacter = resolveCharacter(null);
    if (!firstCharacter) return;
    setActiveCharacter(firstCharacter);
    const timer = setTimeout(() => {
      setBubble({
        text: 'こんにちは！何でも聞いてね〜！',
        isThinking: false,
        isError: false,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [resolveCharacter]);

  useEffect(() => {
    shopMap.current = new Map(shops.map((shop) => [shop.id, shop]));
  }, [shops]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, INPUT_MIN_HEIGHT), INPUT_MAX_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
  }, [inputText]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (tickerRef.current) clearInterval(tickerRef.current);
    clearPlayback();
  }, [clearPlayback]);

  const submitFeedback = useCallback(
    async (rating: 1 | -1, comment?: string) => {
      if (!lastConsultId) return;
      setFeedbackGiven(true);
      setThumbsDownOpen(false);
      try {
        await fetch('/api/grandma/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultId: lastConsultId,
            turnIndex: 0,
            rating,
            comment: comment ?? null,
            questionText: lastQuestionText ?? undefined,
            turnText: lastTurnText ?? undefined,
          }),
        });
      } catch {
        // fire and forget
      }
    },
    [lastConsultId, lastQuestionText, lastTurnText]
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim();
      if (!text || isBusy) return;

      abortRef.current?.abort();
      if (tickerRef.current) clearInterval(tickerRef.current);
      clearPlayback();
      setLastConsultId(null);
      setFeedbackGiven(false);
      setThumbsDownOpen(false);
      setThumbsDownComment('');
      setRecommendedShops([]);
      setRouteIds(new Set());

      const controller = new AbortController();
      abortRef.current = controller;
      const visitorKey = getOrCreateConsultVisitorKey();

      setInputText('');
      setStatus('loading');
      setElapsedSeconds(0);
      setActiveCharacter(resolveCharacter(null));
      setBubble({ text: null, isThinking: true, isError: false });

      let hadError = false;
      let playbackStarted = false;

      const startTime = Date.now();
      const ticker = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      tickerRef.current = ticker;

      const userMsg = { role: 'user' as const, text };
      const nextHistory = [...history, userMsg];
      setHistory(nextHistory);

      try {
        const res = await fetch('/api/grandma/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            location: null,
            history: nextHistory.slice(-6),
            visitorKey,
            stream: false,
          }),
          signal: controller.signal,
        });

        const payload = (await res.json().catch(() => null)) as AskPayload | null;
        const turns = (payload?.turns ?? []).filter(
          (turn): turn is ConsultTurn => !!turn && typeof turn.text === 'string' && turn.text.trim().length > 0
        );

        if (!res.ok) {
          hadError = true;
          playResponseSequence(
            turns.length > 0
              ? turns
              : [
                  {
                    speakerId: resolveCharacter(null)?.id ?? 'nichiyosan',
                    speakerName: resolveCharacter(null)?.name ?? 'にちよさん',
                    text: payload?.reply ?? payload?.errorMessage ?? `HTTP ${res.status}`,
                  },
                ],
            [],
            true
          );
          return;
        }

        const finalReply =
          payload?.reply ??
          turns.map((turn) => turn.text).filter(Boolean).join(' ') ??
          '';
        const finalShopIds = payload?.shopIds ?? [];

        if (finalShopIds.length > 0) {
          onShopsRecommended(finalShopIds);
          const resolved = finalShopIds.map((id) => shopMap.current.get(id)).filter(Boolean) as Shop[];
          setRecommendedShops(resolved);
        }

        if (payload?.consultId) {
          setLastConsultId(payload.consultId);
          setLastQuestionText(text);
          setLastTurnText(turns[0]?.text ?? null);
        }

        playbackStarted = playResponseSequence(turns, finalShopIds, false);
        setHistory([...nextHistory, { role: 'assistant', text: finalReply }]);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;

        hadError = true;
        setStatus('error');
        setActiveCharacter(resolveCharacter(null));
        setBubble({
          text: 'うまく聞こえんかった…通信状況を確認してからもう一度試してみてね。',
          isThinking: false,
          isError: true,
        });
      } finally {
        clearInterval(ticker);
        if (tickerRef.current === ticker) {
          tickerRef.current = null;
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
          if (!hadError && !playbackStarted) {
            setStatus('idle');
          }
        }
      }
    },
    [clearPlayback, history, inputText, isBusy, onShopsRecommended, playResponseSequence, resolveCharacter]
  );

  const lastUserMsg = history.findLast?.((message) => message.role === 'user')?.text ?? null;
  const handleRetry = useCallback(() => {
    if (!lastUserMsg) return;
    setStatus('idle');
    setBubble({ text: null, isThinking: false, isError: false });
    clearPlayback();
    setTimeout(() => handleSend(lastUserMsg), 100);
  }, [clearPlayback, handleSend, lastUserMsg]);

  const handleFavorite = (shopId: number) => {
    const next = toggleFavoriteShopId(shopId);
    setFavoriteIds(new Set(next));
  };

  const handleAddToRoute = (shop: Shop) => {
    if (typeof window === 'undefined') return;
    let stored: Partial<StoredPlan> = {};
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (raw) stored = JSON.parse(raw) as StoredPlan;
    } catch { /* ignore */ }
    const plan = stored.plan ?? { title: 'AIおすすめ', summary: '', shops: [], routeHint: '', shoppingList: [] };
    if (!plan.shops.some((s) => s.id === shop.id)) {
      plan.shops.push({ id: shop.id, name: shop.name, reason: '', icon: '🏪' });
    }
    const order = plan.shops.map((s) => s.id);
    localStorage.setItem(PLAN_KEY, JSON.stringify({ plan, order }));
    setRouteIds((prev) => new Set([...prev, shop.id]));
  };

  // 現在のマップ上の会話を /consult のフルチャットへ引き継いでから遷移する。
  const handleExpandToFullChat = useCallback(() => {
    if (typeof window !== 'undefined' && history.length > 0) {
      const messages = history.map((message) => ({
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: message.role,
        text: message.text,
      }));
      try {
        localStorage.setItem(
          CONSULT_CHAT_STORAGE_KEY,
          JSON.stringify({ messages, hasUserAsked: true })
        );
      } catch {
        // localStorage への書き込みに失敗した場合は履歴なしで遷移する
      }
    }
    router.push('/consult');
  }, [history, router]);

  const statusLabel = getStatusLabel(status, elapsedSeconds);
  const helperTextId = 'map-consult-helper';
  const statusTextId = 'map-consult-status';
  const inputDescription = statusLabel ? `${helperTextId} ${statusTextId}` : helperTextId;

  return (
    <div className="pointer-events-none absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] left-4 right-4 z-[1300] translate-y-[30px]">
      <div className="mb-3 flex justify-start">
        {activeCharacter && (
          <CharacterSprite
            character={activeCharacter}
            text={bubble.text}
            isThinking={bubble.isThinking}
            isError={bubble.isError}
          />
        )}
      </div>

      {/* サジェストはチャット枠から独立した「浮くピル」として上に表示する */}
      {showIntroChrome && (
        <div
          className="pointer-events-auto mb-2 flex flex-wrap justify-start gap-1.5"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {starterPrompts.map((prompt) => (
            <PromptSuggestion
              key={prompt}
              onClick={() => handleSend(prompt)}
              variant="outline"
              size="sm"
              className="border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 active:scale-[0.99]"
            >
              {prompt}
            </PromptSuggestion>
          ))}
        </div>
      )}

      <div
        className="pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          className={`relative mx-auto max-w-xl overflow-hidden rounded-[24px] border shadow-[0_28px_60px_rgba(15,23,42,0.22)] transition-all duration-300 ${
            status === 'error'
              ? 'border-red-300 bg-[#fff6f6]'
              : isBusy
                ? 'border-amber-300 bg-white'
                : 'border-amber-200 bg-white'
          }`}
        >
          <button
            type="button"
            onClick={handleExpandToFullChat}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm backdrop-blur transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
            aria-label="全画面のチャットで続ける"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          </button>

          <div className="sr-only" id={helperTextId}>
            市場のことを相談できます。
          </div>

          {statusLabel && (
            <div className="sr-only" id={statusTextId} aria-live="polite">
              {statusLabel}
            </div>
          )}

          {!isBusy && <div className={showIntroChrome ? 'px-3 pb-3 pt-3' : 'px-2.5 py-2.5'}>
            <div>
              <div className="flex items-end gap-2">
                {!showIntroChrome ? (
                  <div className="mb-0.5 shrink-0">
                    {activeCharacter ? (
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#fff6e5] shadow-sm">
                        <Image
                          src={activeCharacter.image}
                          alt={activeCharacter.name}
                          width={44}
                          height={44}
                          className={`h-full w-full object-cover ${activeCharacter.imageScale}`}
                          style={{ objectPosition: activeCharacter.imagePosition }}
                          draggable={false}
                        />
                      </div>
                    ) : (
                      <div className="h-11 w-11 rounded-2xl border border-slate-200 bg-[#fff6e5] shadow-sm" />
                    )}
                  </div>
                ) : null}

                <Textarea
                  id="map-consult-input"
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  aria-describedby={inputDescription}
                  placeholder="気になることを入力"
                  rows={1}
                  className={`min-h-[58px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 shadow-none focus-visible:ring-0 ${
                    status === 'error'
                      ? 'text-red-700 placeholder:text-red-300'
                      : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className="mb-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-pop transition-all bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:shadow-none active:scale-[0.98]"
                  aria-label="送信"
                >
                  ↑
                </button>
              </div>

            </div>

            {status === 'error' && lastUserMsg && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="rounded-full bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-200 active:scale-95"
                >
                  直前の相談を再試行
                </button>
              </div>
            )}

            {status === 'idle' && lastConsultId && !feedbackGiven && !thumbsDownOpen && (
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <span className="text-[11px] text-slate-400">参考になりましたか？</span>
                <button
                  type="button"
                  onClick={() => submitFeedback(1)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[13px] shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="役に立った"
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => setThumbsDownOpen(true)}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[13px] shadow-sm transition hover:bg-slate-50 active:scale-95"
                  aria-label="役に立たなかった"
                >
                  👎
                </button>
              </div>
            )}

            {thumbsDownOpen && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={thumbsDownComment}
                  onChange={(e) => setThumbsDownComment(e.target.value)}
                  placeholder="改善点を教えてください（任意）"
                  className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-amber-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitFeedback(-1, thumbsDownComment);
                  }}
                />
                <button
                  type="button"
                  onClick={() => submitFeedback(-1, thumbsDownComment)}
                  className="shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
                >
                  送信
                </button>
              </div>
            )}

            {status === 'idle' && feedbackGiven && (
              <p className="mt-2 text-right text-[11px] text-slate-400">評価済み ✓</p>
            )}

            {recommendedShops.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {recommendedShops.map((shop) => (
                  <div
                    key={shop.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">{shop.name}</span>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleFavorite(shop.id)}
                        className={`rounded-full border px-2 py-1 text-[13px] shadow-sm transition hover:scale-105 active:scale-95 ${
                          favoriteIds.has(shop.id)
                            ? 'border-pink-200 bg-pink-50 text-pink-500'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                        aria-label="お気に入りに追加"
                      >
                        {favoriteIds.has(shop.id) ? '❤️' : '🤍'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddToRoute(shop)}
                        disabled={routeIds.has(shop.id)}
                        className={`rounded-full border px-2 py-1 text-[13px] shadow-sm transition hover:scale-105 active:scale-95 disabled:cursor-default ${
                          routeIds.has(shop.id)
                            ? 'border-green-200 bg-green-50 text-green-600'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                        aria-label="ルートに追加"
                      >
                        {routeIds.has(shop.id) ? '✓' : '🗺️'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
}
