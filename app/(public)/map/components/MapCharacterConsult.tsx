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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { Map as LeafletMap } from 'leaflet';
import { Textarea } from '@/components/ui/textarea';
import {
  CONSULT_CHARACTER_BY_ID,
  pickConsultCharacters,
  type ConsultCharacter,
} from '../../consult/data/consultCharacters';
import type { ConsultAskResponse, ConsultTurn } from '../../consult/types/consultConversation';
import type { Shop } from '../data/shops';
import { getOrCreateConsultVisitorKey } from '../../../../lib/consultVisitorKey';

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


function getStarterPrompts(historyLength: number): string[] {
  if (historyLength > 0) {
    return ['近い順で教えて', '休める場所も知りたい', 'ほかの候補もある？'];
  }

  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) {
    return ['朝ごはんのおすすめは？', '今の混み具合は？', 'サクッと回るコツある？'];
  }
  if (hour >= 11 && hour < 15) {
    return ['ランチならどこ？', '食べ歩き向けは？', '子ども連れでも回りやすい？'];
  }
  if (hour >= 15 && hour < 18) {
    return ['休憩できる場所ある？', 'おやつに向くお店は？', '写真映えする場所は？'];
  }
  return ['晩ご飯のおかず探したい', 'お土産向きは？', '今からでも寄れるお店は？'];
}

export default function MapCharacterConsult({
  map,
  shops,
  onShopsRecommended,
  onClose,
}: {
  map: LeafletMap | null;
  shops: Shop[];
  onShopsRecommended: (shopIds: number[]) => void;
  onClose: () => void;
}) {
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

  const shopMap = useRef(new Map(shops.map((shop) => [shop.id, shop])));
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackSequenceRef = useRef(0);

  const isBusy = status === 'loading' || status === 'playing';
  const starterPrompts = useMemo(() => getStarterPrompts(history.length), [history.length]);
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

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim();
      if (!text || isBusy) return;

      abortRef.current?.abort();
      if (tickerRef.current) clearInterval(tickerRef.current);
      clearPlayback();

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

      <div
        className="pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto max-w-xl overflow-hidden border shadow-[0_28px_60px_rgba(15,23,42,0.22)] transition-all duration-300 ${
            showIntroChrome ? 'rounded-[28px]' : 'rounded-[24px]'
          } ${
            status === 'error'
              ? 'border-red-300 bg-[#fff6f6]'
              : isBusy
                ? 'border-amber-300 bg-white'
                : 'border-amber-200 bg-white'
          }`}
        >
          {showIntroChrome ? (
            <>
              <div className="bg-[linear-gradient(135deg,#fff8e8_0%,#fff3d8_48%,#fde6ba_100%)] px-4 py-3.5">
                <div className="flex items-start">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="map-consult-input"
                      className="block text-[15px] font-bold leading-tight text-slate-900"
                    >
                      AIに相談する
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-bold text-slate-600 shadow-sm transition hover:bg-white active:scale-95"
                    aria-label="相談を終わる"
                  >
                    閉じる
                  </button>
                </div>
              </div>

              {!isBusy && starterPrompts.length > 0 && (
                <div className="border-b border-slate-200/70 px-3 pb-3 pt-3">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      すぐ聞けること
                    </span>
                    <span className="text-[11px] text-slate-400">最初の一言を選べます</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto px-1 pb-1">
                    {starterPrompts.slice(0, 3).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="shrink-0 rounded-chip border border-amber-200 bg-white px-[13px] py-[7px] text-left text-[13px] font-bold text-amber-900 shadow-chip transition-all duration-[120ms] hover:bg-amber-50 active:scale-[0.98]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="sr-only" id={helperTextId}>
              市場のことを相談できます。
            </div>
          )}

          {!showIntroChrome && statusLabel && (
            <div className="sr-only" id={statusTextId} aria-live="polite">
              {statusLabel}
            </div>
          )}

          {!isBusy && <div className={showIntroChrome ? 'px-3 pb-3 pt-3' : 'px-2.5 py-2.5'}>
            <div
              className={`rounded-[24px] border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-colors ${
                status === 'error'
                  ? 'border-red-200 bg-white'
                  : 'border-slate-200 bg-white'
              }`}
            >
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
          </div>}
        </div>
      </div>
    </div>
  );
}
