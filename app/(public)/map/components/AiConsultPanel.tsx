"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronRight, Send, Sparkles } from "lucide-react";
import type { Shop } from "../data/shops";
import type { BannerTheme } from "./ShopBannerHero";
import { ShopSubviewHeader } from "./ShopBannerHero";
import { ConsultFeedback } from "@/components/consult/ConsultFeedback";

type ChatMsg = { role: "user" | "assistant"; text: string };

const AI_SUGGESTED_PROMPTS = [
  { icon: "🛍️", text: "どんな商品がありますか？" },
  { icon: "⭐", text: "おすすめはなんですか？" },
  { icon: "🕐", text: "何時まで営業していますか？" },
  { icon: "💴", text: "支払いはカードで払えますか？" },
  { icon: "🌧️", text: "雨の日でも出店していますか？" },
];

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
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  /** 直近の回答を識別する ID と、そのときの質問。評価を送るときに使う */
  const [lastConsultId, setLastConsultId] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setStreaming(false);
    setLastConsultId(null);
    setLastQuestion("");
    abortRef.current?.abort();
  }, [shop.id]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const history = messages;
      setMessages((prev) => [
        ...prev,
        { role: "user", text: trimmed },
        { role: "assistant", text: "" },
      ]);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/grandma/shop-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            shopName: shop.name,
            shopContext: {
              category: shop.category,
              catchphrase: shop.catchphrase,
              shopStrength: shop.shopStrength,
              products: shop.products,
              chome: shop.chome,
            },
            history,
            text: trimmed,
          }),
        });
        if (!res.ok || !res.body) throw new Error("upstream error");

        // この回答を識別する ID。評価を送るときに使う
        setLastConsultId(res.headers.get("X-Consult-Id") ?? null);
        setLastQuestion(trimmed);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant") {
              copy[copy.length - 1] = { ...last, text: last.text + chunk };
            }
            return copy;
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === "assistant" && !last.text) {
              copy[copy.length - 1] = {
                ...last,
                text: "ごめんよ、うまく答えられんかったわ…もう一回試してみてね。",
              };
            }
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, shop, streaming]
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const handleSubmit = useCallback(() => sendMessage(input), [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
        title="AIに相談する"
        titleIcon={<Sparkles className="h-3.5 w-3.5" style={{ color: theme.accent }} />}
        onBack={onBack}
        onClose={onClose}
        rightSlot={
          !isEmpty ? (
            <button
              type="button"
              onClick={() => { setMessages([]); setInput(""); setLastConsultId(null); setLastQuestion(""); }}
              className="text-xs font-semibold text-slate-400 transition hover:text-slate-600 px-2 py-1.5 rounded-full hover:bg-slate-100"
            >
              クリア
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isEmpty ? (
          <div className="flex flex-col items-center px-5 py-6 gap-5">
            <div className="flex flex-col items-center gap-3">
              <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-md"
                style={{ backgroundColor: theme.light }}
              >
                <Image
                  src="/images/obaasan_transparent.png"
                  alt="にちよさん"
                  width={56}
                  height={56}
                  className="h-14 w-14 opacity-85"
                />
                <span
                  className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white shadow"
                  style={{ backgroundColor: theme.accent }}
                >
                  AI
                </span>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-bold text-slate-800 leading-snug">
                  {shop.name}のことなら何でも！
                </p>
                <p className="mt-1 text-xs text-slate-400">土佐弁で親切にお答えするがよ〜</p>
              </div>
            </div>

            <div className="flex w-full items-center gap-3">
              <div className="flex-1 border-t border-slate-100" />
              <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                よく聞かれる質問
              </p>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <div className="w-full space-y-2">
              {AI_SUGGESTED_PROMPTS.map(({ icon, text }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => sendMessage(text)}
                  className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition hover:opacity-80 active:scale-[0.98] text-left"
                  style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="flex-1">{text}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" style={{ color: theme.text }} />
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-300 text-center leading-relaxed">
              AIの回答はお店情報に基づく参考情報です。<br />
              内容の正確性を保証するものではありません。
            </p>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-5 pb-3">
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
                  {!isUser && (
                    <div
                      className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm"
                      style={{ backgroundColor: theme.light }}
                    >
                      <Image
                        src="/images/obaasan_transparent.png"
                        alt="にちよさん"
                        width={24}
                        height={24}
                        className="h-6 w-6 opacity-85"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-br-sm bg-slate-900 text-white"
                        : "rounded-bl-sm border text-slate-800"
                    }`}
                    style={!isUser ? { borderColor: theme.border, backgroundColor: theme.bg } : undefined}
                  >
                    {showTyping ? (
                      <span className="inline-flex items-center gap-1 py-0.5 px-0.5">
                        {[0, 160, 320].map((delay) => (
                          <span
                            key={delay}
                            className="h-2 w-2 rounded-full animate-bounce"
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

      <div className="shrink-0 border-t bg-white px-3 pt-2 pb-3" style={{ borderColor: theme.border }}>
        {streaming && (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={handleAbort}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: theme.accent }} />
              生成を停止
            </button>
          </div>
        )}
        <div
          className="flex items-end gap-2 rounded-2xl border bg-slate-50 px-3.5 py-2.5 transition-shadow focus-within:shadow-md focus-within:bg-white"
          style={{ borderColor: theme.border }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? "回答中…" : "質問を入力（Shift+Enterで改行）"}
            disabled={streaming}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            style={{ lineHeight: "1.5", maxHeight: 120, overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || streaming}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow transition disabled:opacity-30 hover:opacity-90 active:scale-95"
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
