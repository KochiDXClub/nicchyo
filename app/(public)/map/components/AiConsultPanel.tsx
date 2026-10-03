"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { ChevronRight, Send, Sparkles } from "lucide-react";
import type { Shop } from "../data/shops";
import type { BannerTheme } from "./ShopBannerHero";
import { ShopSubviewHeader } from "./ShopBannerHero";
import { useShopChat, useShopChatCharacter } from "./useShopChat";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { isImeComposing } from "@/lib/utils/isImeComposing";
import { buildConsultGreeting } from "@/lib/grandma/consultGreeting";
import { buildShopChatSuggestions } from "@/lib/grandma/shopChat/suggestions";
import type { ShopChatCharacterView } from "@/lib/grandma/shopChat/character";
import { ConsultFeedback } from "@/components/consult/ConsultFeedback";

/** 会話の中で、答えの横に出す小さな顔 */
function CharacterFace({ character, background }: { character: ShopChatCharacterView; background: string }) {
  return (
    <span
      className="relative mb-0.5 block h-9 w-9 shrink-0 overflow-hidden rounded-full"
      style={{ backgroundColor: background }}
    >
      <Image
        src={character.image}
        alt=""
        fill
        sizes="2.25rem"
        className={`object-cover ${character.id === DEFAULT_CONSULT_CHARACTER.id ? "" : character.imageScale}`}
        style={{ objectPosition: character.id === DEFAULT_CONSULT_CHARACTER.id ? "center 28%" : character.imagePosition }}
      />
    </span>
  );
}

/**
 * お店ごとのAI相談。
 *
 * 答えるのはお店の人が選んだキャラクター。絵は枠に入れず、相談ページと同じように
 * そのまま画面の主役に置く。最初のひとことも、そのキャラの言い方で出す。
 */
export function AiConsultPanel({
  shop,
  bannerImage,
  heroImageError,
  theme,
  onBack,
  onClose,
  isActive: _isActive,
}: {
  shop: Shop;
  bannerImage: string;
  heroImageError: boolean;
  theme: BannerTheme;
  onBack: () => void;
  onClose?: () => void;
  isActive: boolean;
}) {
  const { messages, streaming, lastConsultId, lastQuestion, send, abort, reset } = useShopChat(shop.id);
  const { character: loadedCharacter, settled } = useShopChatCharacter(shop.id);
  // 取れなかったときは、既定のにちよさんで続ける（相談自体は止めない）
  const character: ShopChatCharacterView = loadedCharacter ?? DEFAULT_CONSULT_CHARACTER;

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // お店が変わったら入力も捨てる
  useEffect(() => {
    setInput("");
  }, [shop.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 時刻で呼びかけが変わるので、サーバーの描画と食い違わないよう、開いてから決める
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, [shop.id]);
  const greeting = useMemo(
    () => (now ? buildConsultGreeting({ now, script: character.greeting, index: shop.id }) : null),
    [now, character, shop.id]
  );

  const suggestions = useMemo(() => buildShopChatSuggestions(shop), [shop]);

  const adjustTextarea = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      adjustTextarea(e.target);
    },
    [adjustTextarea]
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || streaming) return;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      void send(text);
    },
    [send, streaming]
  );

  const handleSubmit = useCallback(() => sendMessage(input), [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isImeComposing(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleClear = useCallback(() => {
    reset();
    setInput("");
  }, [reset]);

  const isEmpty = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const isTyping = streaming && lastMsg?.role === "assistant" && !lastMsg.text;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ShopSubviewHeader
        shop={shop}
        bannerImage={bannerImage}
        heroImageError={heroImageError}
        onImageError={() => {}}
        theme={theme}
        title={settled ? `${character.name}に相談` : "AIに相談する"}
        titleIcon={<Sparkles className="h-3.5 w-3.5" style={{ color: theme.accent }} />}
        onBack={onBack}
        onClose={onClose}
        rightSlot={
          !isEmpty ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full px-2 py-1.5 text-xs font-semibold text-nicchyo-ink/55 transition hover:bg-nicchyo-base hover:text-nicchyo-ink"
            >
              クリア
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isEmpty ? (
          <div className="flex flex-col items-center px-5 pb-6 pt-5">
            {/* 絵は枠に入れず、そのまま置く。誰が答えるのかは取れてから出す（別の人が一瞬映らないように） */}
            <div className="flex h-[128px] items-end justify-center">
              {settled && (
                <GrandmaAvatar
                  character={character}
                  size="compact"
                  pose={streaming ? "thinking" : "idle"}
                  className="consult-reveal is-shown"
                />
              )}
            </div>

            <div className={`mt-2 flex flex-col items-center transition-opacity duration-300 ${settled ? "opacity-100" : "opacity-0"}`}>
              <p className="text-sm font-bold text-nicchyo-ink">
                {character.name}
                <span className="ml-1.5 align-middle text-[10px] font-semibold text-nicchyo-ink/55">AI</span>
              </p>
              <p className="mt-0.5 text-center text-xs leading-relaxed text-nicchyo-ink/55">{character.subtitle}</p>

              {/* そのキャラの言い方の、最初のひとこと */}
              {greeting && (
                <div
                  className="relative mt-4 max-w-[19rem] rounded-card bg-white px-4 py-3 text-center text-sm leading-relaxed text-nicchyo-ink shadow-card ring-1"
                  style={{ ["--tw-ring-color" as string]: theme.border }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t bg-white"
                    style={{ borderColor: theme.border }}
                  />
                  {greeting}
                  <span className="mt-1 block text-xs font-semibold text-nicchyo-ink/70">
                    {shop.name}のこと、聞いてね。
                  </span>
                </div>
              )}
            </div>

            <ul className="mt-6 w-full space-y-2">
              {suggestions.map(({ icon, text }) => (
                <li key={text}>
                  <button
                    type="button"
                    onClick={() => sendMessage(text)}
                    className="flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left text-sm font-medium transition hover:opacity-80 active:scale-[0.98] motion-reduce:active:scale-100"
                    style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}
                  >
                    <span className="text-base leading-none" aria-hidden="true">{icon}</span>
                    <span className="flex-1">{text}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-5 text-center text-[10px] leading-relaxed text-nicchyo-ink/40">
              AIの回答はお店の情報に基づく参考情報です。<br />
              内容の正確性を保証するものではありません。
            </p>
          </div>
        ) : (
          <div className="space-y-3 px-4 pb-3 pt-5">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isLastAssistant = !isUser && i === messages.length - 1;
              const showTyping = isTyping && isLastAssistant;

              return (
                <div
                  key={i}
                  className={`flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!isUser && <CharacterFace character={character} background={theme.light} />}
                  <div
                    className={`max-w-[78%] rounded-card px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-br-sm bg-nicchyo-ink text-white"
                        : "rounded-bl-sm border text-nicchyo-ink"
                    }`}
                    style={!isUser ? { borderColor: theme.border, backgroundColor: theme.bg } : undefined}
                  >
                    {showTyping ? (
                      <span className="inline-flex items-center gap-1 px-0.5 py-0.5" role="status" aria-label="考えています">
                        {[0, 160, 320].map((delay) => (
                          <span
                            key={delay}
                            className="h-2 w-2 animate-bounce rounded-full"
                            style={{ backgroundColor: theme.accent, animationDelay: `${delay}ms`, opacity: 0.7 }}
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* 答えが出そろってから評価を出す。書いている途中には出さない */}
            {!streaming && lastConsultId && (
              <ConsultFeedback
                key={lastConsultId}
                consultId={lastConsultId}
                questionText={lastQuestion}
                answerText={messages[messages.length - 1]?.text}
                className="px-1 pb-1"
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-white px-3 pb-3 pt-2" style={{ borderColor: theme.border }}>
        {streaming && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={abort}
              className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-nicchyo-ink/70 shadow-sm ring-1 ring-line transition hover:bg-nicchyo-base active:scale-95 motion-reduce:active:scale-100"
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: theme.accent }} />
              生成を停止
            </button>
          </div>
        )}
        <div
          className="flex items-end gap-2 rounded-card border bg-nicchyo-base px-3.5 py-2.5 transition-shadow focus-within:bg-white focus-within:shadow-md"
          style={{ borderColor: theme.border }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? "回答中…" : `${character.name}に質問を入力`}
            aria-label="質問を入力"
            disabled={streaming}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            style={{ lineHeight: "1.5", maxHeight: 120, overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || streaming}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-white shadow transition hover:opacity-90 active:scale-95 disabled:opacity-30 motion-reduce:active:scale-100"
            style={{ backgroundColor: theme.accent }}
            aria-label="送信"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
