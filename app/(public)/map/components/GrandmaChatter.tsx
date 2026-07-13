/* eslint-disable @next/next/no-img-element */
"use client";

import React, { memo, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import MessageBubble from "../../consult/components/MessageBubble";
import {
  CONSULT_CHARACTERS,
  CONSULT_CHARACTER_BY_ID,
  pickConsultCharacters,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "../../consult/data/consultCharacters";
import type {
  ConsultAskResponse,
  ConsultErrorCode,
  ConsultHistoryEntry,
  ConsultAskStreamEvent,
} from "../../consult/types/consultConversation";
import { grandmaAiInstructorLines } from "../data/grandmaComments";
import { grandmaCommentPool, pickNextComment } from "../services/grandmaCommentService";
import type { Shop } from "../data/shops";
import { getSmartSuggestions } from "../utils/suggestionGenerator";
import { getShopBannerImage } from "@/lib/shopImages";
import { saveAiMapPayload } from "@/lib/searchMapStorage";
import { useAvatarDrag } from "../../../../lib/hooks/useAvatarDrag";
const ROTATE_MS = 6500;
const EXAMPLE_ROTATE_MS = 4500;

type PriorityMessage = {
  text: string;
  badgeTitle?: string;
  badgeIcon?: string;
};

type AskContext = { shopId?: number; shopName?: string; source?: "suggestion" | "input" };

const SHOP_CONSULT_PROMPT = "このお店のおすすめやこだわりを詳しく教えて";

type PendingSubmission = {
  text: string;
  imageFile?: File | null;
  imagePreview?: string | null;
  context?: AskContext;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  imageUrl?: string;
  shopIds?: number[];
  shops?: Shop[];
  localImageUrl?: string;
  speakerId?: ConsultCharacterId;
  speakerName?: string;
  followUpQuestion?: string;
  consultId?: string;
  turnIndex?: number;
};

type GrandmaChatterProps = {
  comments?: typeof grandmaCommentPool;
  titleLabel?: string;
  priorityMessage?: PriorityMessage | null;
  onPriorityClick?: () => void;
  onPriorityDismiss?: () => void;
  onAsk?: (
    text: string,
    imageFile?: File | null,
    context?: AskContext,
    history?: ConsultHistoryEntry[],
    memorySummary?: string
  ) => Promise<ConsultAskResponse>;
  onAskStream?: (
    text: string,
    imageFile: File | null | undefined,
    context: AskContext | undefined,
    history: ConsultHistoryEntry[] | undefined,
    memorySummary: string | undefined,
    onEvent: (event: ConsultAskStreamEvent) => void
  ) => Promise<ConsultAskResponse>;
  allShops?: Shop[];
  aiSuggestedShops?: Shop[];
  onSelectShop?: (shopId: number, shop?: Shop) => void;
  fullWidth?: boolean;
  onHoldChange?: (holding: boolean) => void;
  onDrop?: (position: { x: number; y: number }) => void;
  onActiveShopChange?: (shopId: number | null) => void;
  onCommentShopFocus?: (shopId: number) => void;
  onCommentShopOpen?: (shopId: number) => void;
  introImageUrl?: string | null;
  onAiImageClick?: (imageUrl: string) => void;
  initialOpen?: boolean;
  layout?: "floating" | "page";
  onClear?: () => void;
  autoAskText?: string | null;
  autoAskContext?: { shopId?: number; shopName?: string };
  currentZoom?: number;
  enableSpeechInput?: boolean;
  variant?: "default" | "consult";
  preferredCharacterId?: ConsultCharacterId | null;
  onPreferredCharacterChange?: (characterId: ConsultCharacterId | null) => void;
  onCommentSeen?: (id: string, genre: string) => void;
  embedded?: boolean;
};

// ─── キャラクター相談中アニメーション ────────────────────────────────────────
const EMOTION_SYMBOLS = ["!", "?", "!!", "！？", "?!", "？"];

type ThinkingEntry = { character: ConsultCharacter; symbol: string };

function pickThinkingData(preferredId?: ConsultCharacterId | null): ThinkingEntry[] {
  const chars = pickConsultCharacters(preferredId ?? undefined);
  return chars.map((c) => ({
    character: c,
    symbol: EMOTION_SYMBOLS[Math.floor(Math.random() * EMOTION_SYMBOLS.length)],
  }));
}

function ThinkingDiscussion({ data }: { data: ThinkingEntry[] }) {
  const cycleDuration = data.length * 0.9;

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="flex items-end justify-center gap-6">
        {data.map(({ character: char, symbol }, i) => (
          <div key={char.id} className="relative flex flex-col items-center gap-1">

            {/* 感情バブル (!, ? など) — メインバブルから少し遅れて出現 */}
            <div
              className="absolute -top-7 -right-1 min-w-[1.75rem] rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-center text-[11px] font-black leading-none text-amber-600 shadow-sm"
              style={{
                animation: `discussion-bubble ${cycleDuration}s ease-in-out ${i * 0.9 + 0.38}s infinite`,
              }}
            >
              {symbol}
            </div>

            {/* ... 吹き出し */}
            <div
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm"
              style={{
                animation: `discussion-bubble ${cycleDuration}s ease-in-out ${i * 0.9}s infinite`,
              }}
            >
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((j) => (
                  <span
                    key={j}
                    className="block h-1.5 w-1.5 rounded-full bg-slate-400"
                    style={{ animation: `dot-pulse 0.75s ease-in-out ${j * 0.18}s infinite` }}
                  />
                ))}
              </div>
            </div>
            {/* 矢印 */}
            <div
              className="-mt-0.5 h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-white"
              style={{
                animation: `discussion-bubble ${cycleDuration}s ease-in-out ${i * 0.9}s infinite`,
                filter: "drop-shadow(0 1px 0 rgba(148,163,184,0.25))",
              }}
            />
            {/* アバター */}
            <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-amber-200 bg-amber-50 shadow-sm">
              <img
                src={char.image}
                alt={char.name}
                className={`h-full w-full object-cover ${char.imageScale}`}
                style={{ objectPosition: char.imagePosition }}
                draggable={false}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-400">{char.name}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] font-medium text-slate-400">みんなで相談しています…</p>
    </div>
  );
}

const GrandmaChatter = memo(function GrandmaChatter({
  comments,
  titleLabel = "おせっかいばあちゃん",
  priorityMessage,
  onPriorityClick,
  onPriorityDismiss,
  onAsk,
  onAskStream,
  allShops,
  aiSuggestedShops,
  onSelectShop,
  fullWidth = false,
  onHoldChange,
  onDrop,
  onActiveShopChange,
  onCommentShopFocus,
  onCommentShopOpen,
  introImageUrl,
  onAiImageClick,
  initialOpen = false,
  layout = "floating",
  onClear,
  autoAskText,
  autoAskContext,
  currentZoom,
  enableSpeechInput = false,
  variant = "default",
  preferredCharacterId,
  onPreferredCharacterChange,
  onCommentSeen,
  embedded = false,
}: GrandmaChatterProps) {
  const isConsultVariant = variant === "consult";
  const pool = comments && comments.length > 0 ? comments : grandmaCommentPool;
  const [currentId, setCurrentId] = useState<string | undefined>(() => pool[0]?.id);
  const current = useMemo(
    () => pool.find((c) => c.id === currentId) ?? pool[0],
    [pool, currentId]
  );
  const [askText, setAskText] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(initialOpen);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [hasUserAsked, setHasUserAsked] = useState(false);
  const [hasProcessedAutoAsk, setHasProcessedAutoAsk] = useState(false);
  const [conversationSummary, setConversationSummary] = useState("");
  const [activeConsultContext, setActiveConsultContext] = useState<AskContext | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [shouldShowValidation, setShouldShowValidation] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ConsultErrorCode | null>(null);
  const [errorHelperQuestions, setErrorHelperQuestions] = useState<string[]>([]);
  const [lastFailedSubmission, setLastFailedSubmission] = useState<PendingSubmission | null>(null);
  const [aiBubbleText, setAiBubbleText] = useState(
    grandmaAiInstructorLines[0] ?? "質問を入力してね。"
  );
  const [aiStatus, setAiStatus] = useState<"idle" | "thinking" | "answered" | "error">(
    "idle"
  );
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [introLockUntil, setIntroLockUntil] = useState<number | null>(null);
  const [isIntroImageOpen, setIsIntroImageOpen] = useState(false);
  const [keyboardShift, setKeyboardShift] = useState(0);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [consultExampleIndex, setConsultExampleIndex] = useState(0);
  const [consultHeroIndex, setConsultHeroIndex] = useState(0);
  const [isPreferredCharacterPickerOpen, setIsPreferredCharacterPickerOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const askRequestRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [activeStreamingMessageId, setActiveStreamingMessageId] = useState<string | null>(null);
  const [thinkingData, setThinkingData] = useState<ThinkingEntry[]>(() => pickThinkingData());
  const chatStorageKeyRef = useRef<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // Walk plan modal / quick flow states (prefixed with _ to avoid unused-var lint warnings until fully implemented)
  const [_showWalkPlanModal, _setShowWalkPlanModal] = useState(false);
  const [_walkPlanQuestionAnswers, _setWalkPlanQuestionAnswers] = useState<{ stops: number; startAt: string; interest: string }>({ stops: 3, startAt: "今すぐ", interest: "" });
  const [ratedMessageIds, setRatedMessageIds] = useState<Set<string>>(new Set());
  const [thumbsDownOpenId, setThumbsDownOpenId] = useState<string | null>(null);
  const [thumbsDownComments, setThumbsDownComments] = useState<Record<string, string>>({});
  const speechStartTextRef = useRef("");
  const speechRecognitionRef = useRef<{
    start: () => void;
    stop: () => void;
    abort: () => void;
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  } | null>(null);
  const speechConstructorRef = useRef<(new () => {
    start: () => void;
    stop: () => void;
    abort: () => void;
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }) | null>(null);
  const [smartContext, setSmartContext] = useState({
    placeholder: "おばあちゃんに質問してね",
    chip: "おすすめは？"
  });
  const consultExampleQuestions = useMemo(
    () => [
      "今の季節におすすめの食材はある？",
      "子ども連れでも楽しめる場所は？",
      "日曜市の回り方を教えて",
      "今やってるイベントある？",
      "お土産にぴったりのものは？",
      "雨の日でも楽しめる場所ある？",
      "近くで座って休める場所ある？",
      "旬の果物が買えるお店は？",
      "混雑を避けるコツってある？",
      "写真映えするスポット教えて",
    ],
    []
  );
  const router = useRouter();
  const lastAvatarOffsetRef = useRef({ x: 0, y: 0 });
  const { avatarOffset, setAvatarOffset, isHolding, holdPhase, consumeWasMoved, handlers } = useAvatarDrag({
    onHoldChange,
    onDrop,
    disabled: isChatOpen,
  });

  useEffect(() => {
    // 時間帯に応じたスマートなデフォルト値の設定
    const hour = new Date().getHours();
    let placeholder = "おばあちゃんに質問してね";
    let chip = "おすすめは？";

    if (hour >= 5 && hour < 11) {
      placeholder = "（例）朝ごはんのおすすめは？";
      chip = "朝ごはんのおすすめ";
    } else if (hour >= 11 && hour < 14) {
      placeholder = "（例）お昼ご飯、どこがいい？";
      chip = "ランチのおすすめ";
    } else if (hour >= 14 && hour < 17) {
      placeholder = "（例）ちょっと休憩したいな";
      chip = "おやつの時間";
    } else if (hour >= 17 && hour < 21) {
      placeholder = "（例）晩ご飯のおかずある？";
      chip = "晩ご飯の買い物";
    } else {
      placeholder = "（例）明日の日曜市は何時から？";
      chip = "日曜市の開催時間";
    }
    setSmartContext({ placeholder, chip });
  }, []);

  useEffect(() => {
    if (!enableSpeechInput) return;
    if (typeof window === "undefined") return;
    const speechConstructor =
      (window as Window & { SpeechRecognition?: typeof speechConstructorRef.current }).SpeechRecognition ??
      (window as Window & { webkitSpeechRecognition?: typeof speechConstructorRef.current })
        .webkitSpeechRecognition;
    if (speechConstructor) {
      speechConstructorRef.current = speechConstructor;
      setIsSpeechSupported(true);
    } else {
      setIsSpeechSupported(false);
    }
    return () => {
      speechRecognitionRef.current?.abort();
      speechRecognitionRef.current = null;
    };
  }, [enableSpeechInput]);

  const stopSpeechRecognition = () => {
    if (!isListening) return;
    speechRecognitionRef.current?.stop();
  };

  const startSpeechRecognition = () => {
    if (!speechConstructorRef.current) return;
    if (isListening) {
      stopSpeechRecognition();
      return;
    }
    const recognition = speechRecognitionRef.current ?? new speechConstructorRef.current();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;
    speechStartTextRef.current = askText;
    recognition.onresult = (event) => {
      const results = Array.from(event.results ?? []);
      const transcript = results.map((result) => result[0]?.transcript ?? "").join("");
      setAskText(`${speechStartTextRef.current}${transcript}`);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    speechRecognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  useEffect(() => {
    if (!pool.length) return;
    setCurrentId((prev) => pickNextComment(pool, prev)?.id ?? pool[0]?.id);
  }, [pool]);

  useEffect(() => {
    if (currentId && current) onCommentSeen?.(currentId, current.genre);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  useEffect(() => {
    if (layout !== "page") return;
    if (typeof window === "undefined") return;
    const key = "nicchyo-consult-chat";
    chatStorageKeyRef.current = key;
    const saved = localStorage.getItem(key);
    if (!saved) {
      setHasLoadedHistory(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved) as
        | ChatMessage[]
        | {
            messages: ChatMessage[];
            hasUserAsked?: boolean;
            conversationSummary?: string;
            activeConsultContext?: AskContext | null;
          };
      const messages = Array.isArray(parsed) ? parsed : parsed.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        setChatMessages(messages);
        setHasUserAsked(
          Array.isArray(parsed)
            ? messages.some((message) => message.role === "user")
            : !!parsed.hasUserAsked || messages.some((message) => message.role === "user")
        );
      }
      if (!Array.isArray(parsed) && parsed.conversationSummary) {
        setConversationSummary(parsed.conversationSummary);
      }
      if (!Array.isArray(parsed) && parsed.activeConsultContext) {
        setActiveConsultContext(parsed.activeConsultContext);
      }
    } catch {
      // ignore malformed history
    } finally {
      setHasLoadedHistory(true);
    }
  }, [layout]);

  const isShopIntro = !isChatOpen && !priorityMessage && !!current?.shopId;
  const activeShopId = isShopIntro ? current?.shopId ?? null : null;
  const showIntroImage = isShopIntro && !!introImageUrl;
  const _introImageSize = { width: 108, height: 144, gap: 12 };
  const showAvatarButton = false;
  const showBubbleAvatar = !isShopIntro;
  const shopLookup = useMemo(() => {
    const source = allShops && allShops.length > 0 ? allShops : aiSuggestedShops ?? [];
    const map = new Map<number, Shop>();
    source.forEach((shop) => map.set(shop.id, shop));
    return map;
  }, [allShops, aiSuggestedShops]);

  useEffect(() => {
    onActiveShopChange?.(activeShopId);
  }, [activeShopId, onActiveShopChange]);

  useEffect(() => {
    if (isShopIntro) {
      const nextLock = Date.now() + 3500;
      setIntroLockUntil((prev) => (prev ? Math.max(prev, nextLock) : nextLock));
    } else {
      setIntroLockUntil(null);
      setIsIntroImageOpen(false);
    }
  }, [isShopIntro, current?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("grandma-chat-open", isChatOpen);
    return () => {
      document.body.classList.remove("grandma-chat-open");
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isChatOpen) {
      setKeyboardShift(0);
      return;
    }
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const heightLoss = Math.max(0, window.innerHeight - viewport.height);
      const offset = Math.max(0, heightLoss - (viewport.offsetTop ?? 0));
      setKeyboardShift(heightLoss / 2);
      setKeyboardOffset(offset);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [isChatOpen]);

  useEffect(() => {
    if (!isChatOpen || !isInputFocused) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isChatOpen, isInputFocused, keyboardShift]);

  useEffect(() => {
    if (!isChatOpen) return;
    const randomIndex = Math.floor(Math.random() * grandmaAiInstructorLines.length);
    const nextLine =
      grandmaAiInstructorLines[randomIndex] ??
      grandmaAiInstructorLines[0] ??
      "質問を入力してね。";
    setAiBubbleText(nextLine);
    setAiStatus("idle");
    setAiImageUrl(null);
    setChatMessages((prev) => {
      if (prev.length > 0) return prev;
      if (layout === "page" && hasLoadedHistory) {
        return prev;
      }
      return [
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: nextLine,
        },
      ];
    });
  }, [hasLoadedHistory, isChatOpen, layout]);

  useEffect(() => {
    if (layout !== "page") return;
    if (!hasLoadedHistory) return;
    if (typeof window === "undefined") return;
    if (!chatStorageKeyRef.current) return;
    const serializable = chatMessages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      imageUrl: message.imageUrl,
      shopIds: message.shopIds,
      shops: message.shops,
      speakerId: message.speakerId,
      speakerName: message.speakerName,
      followUpQuestion: message.followUpQuestion,
    }));
    localStorage.setItem(
      chatStorageKeyRef.current,
      JSON.stringify({
        messages: serializable,
        hasUserAsked,
        conversationSummary,
        activeConsultContext,
      })
    );
  }, [activeConsultContext, chatMessages, conversationSummary, hasLoadedHistory, hasUserAsked, layout]);

  useEffect(() => {
    if (!isChatOpen) return;
    if (layout === "page") {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      return;
    }
    if (!chatScrollRef.current) return;
    const scrollContainer = chatScrollRef.current;

    // Only auto-scroll if we were already near bottom or it's a new message from user/assistant
    const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;

    if (isNearBottom || chatMessages.length > 0) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [chatMessages, isChatOpen, aiStatus, layout]);

  useEffect(() => {
    if (autoAskText && !hasProcessedAutoAsk) {
      setHasProcessedAutoAsk(true);
      if (autoAskContext?.shopId || autoAskContext?.shopName) {
        setActiveConsultContext({
          shopId: autoAskContext?.shopId,
          shopName: autoAskContext?.shopName,
          source: "suggestion",
        });
      }
      if (!isChatOpen) setIsChatOpen(true);

      const autoAskDelayMs = layout === "page" ? 0 : 600;
      const timer = window.setTimeout(() => {
        handleAskSubmit(autoAskText, autoAskContext);
      }, autoAskDelayMs);
      return () => window.clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAskText, autoAskContext, hasProcessedAutoAsk, isChatOpen, layout]);

  useEffect(() => {
    if (layout === "page") {
      setShowScrollToBottom(false);
      return;
    }
    const scrollContainer = chatScrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 100;
      setShowScrollToBottom(!isNearBottom);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [isChatOpen, layout]);

  const handleNext = () => {
    if (isIntroImageOpen) return;
    if (introLockUntil && Date.now() < introLockUntil) return;
    setCurrentId((prev) => pickNextComment(pool, prev)?.id);
  };

  const handleInstructorNext = () => {
    const randomIndex = Math.floor(Math.random() * grandmaAiInstructorLines.length);
    const nextLine =
      grandmaAiInstructorLines[randomIndex] ??
      grandmaAiInstructorLines[0] ??
      "質問を入力してね。";
    setAiBubbleText(nextLine);
  };

  useEffect(() => {
    if (!current) return;
    const shouldRotateInstructor = isChatOpen && aiStatus === "idle";
    const shouldRotateNormal = !isChatOpen && !isIntroImageOpen;
    if (!shouldRotateInstructor && !shouldRotateNormal) return;
    const timer = window.setInterval(() => {
      if (isChatOpen) {
        if (aiStatus === "idle") {
          handleInstructorNext();
        }
      } else {
        handleNext();
      }
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, aiStatus, introLockUntil, isChatOpen, isIntroImageOpen, pool]);

  const showConsultExamples =
    !!current &&
    layout === "page" &&
    isChatOpen &&
    !isInputFocused &&
    !askText.trim() &&
    !selectedImageFile &&
    aiStatus !== "thinking";

  useEffect(() => {
    if (!showConsultExamples || consultExampleQuestions.length <= 1) return;
    const timer = window.setInterval(() => {
      setConsultExampleIndex((prev) => (prev + 1) % consultExampleQuestions.length);
    }, EXAMPLE_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [consultExampleQuestions.length, showConsultExamples]);

  if (!current) return null;

  const handleAvatarClick = () => {
    if (consumeWasMoved()) return;
    if (!isChatOpen) {
      lastAvatarOffsetRef.current = avatarOffset;
      setAvatarOffset({ x: 0, y: 0 });
      if (inputRef.current) {
        try {
          inputRef.current.focus({ preventScroll: true });
        } catch {
          inputRef.current.focus();
        }
      }
      setIsChatOpen(true);
    } else {
      setIsChatOpen(false);
      setAvatarOffset(lastAvatarOffsetRef.current);
      inputRef.current?.blur();
    }
  };

  const shouldValidateInput = layout === "page";

  const beginShopConsult = (shop: Shop) => {
    const nextContext: AskContext = {
      shopId: shop.id,
      shopName: shop.name,
      source: "suggestion",
    };
    setActiveConsultContext(nextContext);
    void handleAskSubmit(SHOP_CONSULT_PROMPT, nextContext, true);
  };

  const submitFeedback = async (messageId: string, rating: 1 | -1, comment?: string) => {
    const message = chatMessages.find((m) => m.id === messageId);
    if (!message?.consultId || message.turnIndex === undefined) return;
    setRatedMessageIds((prev) => new Set(prev).add(messageId));
    setThumbsDownOpenId((prev) => (prev === messageId ? null : prev));
    const questionText = chatMessages
      .slice(0, chatMessages.findIndex((m) => m.id === messageId))
      .reverse()
      .find((m) => m.role === "user")?.text ?? "";
    try {
      await fetch("/api/grandma/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultId: message.consultId,
          turnIndex: message.turnIndex,
          rating,
          comment: comment ?? null,
          questionText,
          turnText: message.text,
        }),
      });
    } catch {
      // fire and forget
    }
  };

  const handleAskSubmit = async (
    text?: string,
    context?: AskContext,
    openChat?: boolean,
    retrySubmission?: PendingSubmission | null
  ) => {
    if (aiStatus === "thinking") return;
    stopSpeechRecognition();
    const submission = retrySubmission ?? {
      text: (text ?? askText).trim(),
      imageFile: selectedImageFile,
      imagePreview: selectedImagePreview,
      context: context ?? activeConsultContext ?? undefined,
    };
    if (submission.context?.shopId || submission.context?.shopName) {
      setActiveConsultContext(submission.context);
    }
    const value = submission.text;
    if (!value && !submission.imageFile) {
      if (shouldValidateInput) {
        setShouldShowValidation(true);
      }
      return;
    }
    if (openChat && !isChatOpen) {
      setIsChatOpen(true);
    }
    const imageFile = submission.imageFile ?? null;
    const imagePreview = submission.imagePreview ?? null;
    setAskText("");
    setSelectedImageName(null);
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    setShouldShowValidation(false);
    setErrorNotice(null);
    setErrorCode(null);
    setErrorHelperQuestions([]);
    setLastFailedSubmission(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setChatMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: value || "（画像を送信）",
        localImageUrl: imagePreview ?? undefined,
      },
    ]);
    setHasUserAsked(true);
    setThinkingData(pickThinkingData(preferredCharacterId));
    setAiStatus("thinking");
    setAiBubbleText("ちょっと待ってね、考えよるよ。");
    setAiImageUrl(null);
    setActiveStreamingMessageId(null);
    const requestId = ++askRequestRef.current;
    let streamedFirstMessageId: string | null = null;
    const historyForRequest: ConsultHistoryEntry[] = chatMessages
      .slice(-8)
      .map((message) => ({
        role: message.role,
        text: message.text,
        speakerId: message.speakerId ?? null,
        speakerName: message.speakerName ?? null,
      }));
    try {
      const handleStreamEvent = (event: ConsultAskStreamEvent) => {
        if (requestId !== askRequestRef.current) return;
        if (event.type === "first_turn_start") {
          if (streamedFirstMessageId) return;
          streamedFirstMessageId = `assistant-stream-${Date.now()}`;
          setActiveStreamingMessageId(streamedFirstMessageId);
          setChatMessages((prev) => [
            ...prev,
            {
              id: streamedFirstMessageId!,
              role: "assistant",
              text: "",
              speakerId: event.speakerId,
              speakerName: event.speakerName,
            },
          ]);
          return;
        }
        if (event.type === "first_turn_delta") {
          if (!streamedFirstMessageId || !event.delta) return;
          setChatMessages((prev) =>
            prev.map((message) =>
              message.id === streamedFirstMessageId
                ? { ...message, text: `${message.text}${event.delta}` }
                : message
            )
          );
        }
      };

      const response = onAskStream
        ? await onAskStream(
            value,
            imageFile ?? undefined,
            submission.context,
            historyForRequest,
            conversationSummary,
            handleStreamEvent
          )
        : onAsk
          ? await onAsk(
              value,
              imageFile ?? undefined,
              submission.context,
              historyForRequest,
              conversationSummary
            )
          : { reply: "いま準備中やき、もう少し待っててね。" };
      if (requestId !== askRequestRef.current) return;
      const reply =
        response.reply || "うまく答えが出せんかった。もう一回聞いてみてね。";
      const isRetryableError = !!response.retryable;
      setAiStatus(isRetryableError ? "error" : "answered");
      setAiBubbleText(reply);
      setAiImageUrl(response.imageUrl ?? null);
      setErrorNotice(response.errorMessage ?? null);
      setErrorCode(response.errorCode ?? null);
      setErrorHelperQuestions(response.helperQuestions ?? []);
      setLastFailedSubmission(isRetryableError ? submission : null);
      if (response.memorySummary) {
        setConversationSummary(response.memorySummary);
      }
      const turns =
        response.turns && response.turns.length > 0
          ? response.turns
          : [
              {
                speakerId: "nichiyosan" as const,
                speakerName: "にちよさん",
                text: reply,
              },
            ];
      const appendAssistantTurn = (
        turn: (typeof turns)[number],
        index: number,
        options?: {
          messageId?: string;
          includeResponseMeta?: boolean;
        }
      ) => {
        const includeResponseMeta = options?.includeResponseMeta ?? index === turns.length - 1;
        setChatMessages((prev) => [
          ...prev,
          {
            id: options?.messageId ?? `assistant-${Date.now()}-${index}`,
            role: "assistant",
            text: turn.text,
            imageUrl: includeResponseMeta ? response.imageUrl : undefined,
            shopIds: includeResponseMeta ? response.shopIds : undefined,
            shops: includeResponseMeta ? response.shops : undefined,
            speakerId: turn.speakerId,
            speakerName: turn.speakerName,
            followUpQuestion: includeResponseMeta ? response.followUpQuestion : undefined,
            consultId: response.consultId,
            turnIndex: index,
          },
        ]);
      };

      if (streamedFirstMessageId && turns.length > 0) {
        const [firstTurn, ...remainingTurns] = turns;
        setChatMessages((prev) =>
          prev.map((message) =>
            message.id === streamedFirstMessageId
              ? {
                  ...message,
                  text: firstTurn.text,
                  imageUrl: remainingTurns.length === 0 ? response.imageUrl : undefined,
                  shopIds: remainingTurns.length === 0 ? response.shopIds : undefined,
                  shops: remainingTurns.length === 0 ? response.shops : undefined,
                  speakerId: firstTurn.speakerId,
                  speakerName: firstTurn.speakerName,
                  followUpQuestion:
                    remainingTurns.length === 0 ? response.followUpQuestion : undefined,
                  consultId: response.consultId,
                  turnIndex: 0,
                }
              : message
          )
        );
        setActiveStreamingMessageId(null);
        for (let index = 0; index < remainingTurns.length; index += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          if (requestId !== askRequestRef.current) return;
          appendAssistantTurn(remainingTurns[index], index + 1, {
            includeResponseMeta: index === remainingTurns.length - 1,
          });
        }
      } else {
        if (turns.length > 0) {
          appendAssistantTurn(turns[0], 0);
        }

        for (let index = 1; index < turns.length; index += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          if (requestId !== askRequestRef.current) return;
          appendAssistantTurn(turns[index], index);
        }
      }
    } catch {
      if (requestId !== askRequestRef.current) return;
      setAiStatus("error");
      setAiBubbleText("ごめんね、今は答えを出せんかった。時間をおいて試してね。");
      setAiImageUrl(null);
      setActiveStreamingMessageId(null);
      setErrorNotice("接続に失敗しました。少し時間をおいて、もう一度試してください。");
      setErrorCode("system_error");
      setErrorHelperQuestions([]);
      setLastFailedSubmission(submission);
      if (streamedFirstMessageId) {
        setChatMessages((prev) =>
          prev.map((message) =>
            message.id === streamedFirstMessageId
              ? {
                  ...message,
                  text: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
                }
              : message
          )
        );
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
          },
        ]);
      }
    }
  };

  const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedImageName(null);
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
      if (shouldValidateInput && !askText.trim()) {
        setShouldShowValidation(true);
      }
      return;
    }
    setErrorNotice(null);
    setErrorCode(null);
    setErrorHelperQuestions([]);
    setLastFailedSubmission(null);
    setSelectedImageName(file.name);
    setSelectedImageFile(file);
    setSelectedImagePreview(URL.createObjectURL(file));
    setShouldShowValidation(false);
  };

  const shellClassName = layout === "page"
    ? "relative w-full pointer-events-auto"
    : fullWidth
      ? "fixed bottom-20 left-0 right-0 z-[1400] pointer-events-none"
      : "fixed bottom-20 left-3 z-[1400] sm:left-4 pointer-events-none";
  const containerClassName = layout === "page"
    ? "relative flex w-full flex-col items-center gap-2"
    : fullWidth
      ? isChatOpen
        ? "relative flex w-full flex-row-reverse items-end justify-center gap-3 pointer-events-none"
        : "relative flex w-full flex-col items-center gap-2 pointer-events-none"
      : "relative flex items-end gap-2 sm:gap-3 pointer-events-none";
  const avatarClassName = fullWidth
    ? "relative h-[84px] w-[84px] shrink-0 sm:h-[96px] sm:w-[96px]"
    : "relative h-[33px] w-[33px] shrink-0 sm:h-[39px] sm:w-[39px]";
  const bubbleBaseClassName = fullWidth
    ? isChatOpen
      ? "relative z-[1000] w-full max-w-none border-0 bg-transparent px-4 py-0 text-left shadow-none pointer-events-auto"
      : "group relative z-[1000] w-full max-w-3xl rounded-2xl border-2 bg-white/95 px-4 py-4 text-left shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl pointer-events-auto"
    : "group relative z-[1000] max-w-[280px] rounded-2xl border-2 bg-white/95 px-4 py-4 text-left shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:shadow-2xl sm:max-w-sm pointer-events-auto";
  const bubbleBorderClass = isConsultVariant
    ? "border-[var(--consult-border)]"
    : isShopIntro
      ? "border-emerald-400"
      : "border-amber-400";
  const bubbleStateClass =
    holdPhase === "active"
      ? "invisible"
      : holdPhase === "priming"
      ? "grandma-scroll-retracting"
      : "";
  const labelClassName = "absolute top-full left-1/2 -translate-x-1/2";
  const isKeyboardOpen = isInputFocused || keyboardShift > 0;
  const hasImageReply = !!aiImageUrl;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const persistedSuggestedShops = useMemo(() => {
    for (let index = chatMessages.length - 1; index >= 0; index -= 1) {
      const message = chatMessages[index];
      if (message.role !== "assistant") continue;
      if (message.shops && message.shops.length > 0) {
        return message.shops;
      }
      if (message.shopIds && message.shopIds.length > 0) {
        const resolved = message.shopIds
          .map((id) => shopLookup.get(id))
          .filter((shop): shop is Shop => !!shop);
        if (resolved.length > 0) {
          return resolved;
        }
      }
    }
    return [];
  }, [chatMessages, shopLookup]);
  const displayedSuggestedShops =
    persistedSuggestedShops.length > 0 ? persistedSuggestedShops : aiSuggestedShops ?? [];
  const hasSuggestedBox =
    displayedSuggestedShops.length > 0 && !isKeyboardOpen;
  const hasSupplement = hasSuggestedBox || hasImageReply;
  const chatLiftClassName = layout === "page"
    ? "translate-y-0"
    : isChatOpen
      ? isKeyboardOpen
        ? "translate-y-[-230px]"
        : hasSupplement
        ? "translate-y-[-60px]"
        : "translate-y-[-230px]"
      : "translate-y-0";
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const _smartSuggestionChips = useMemo(() => {
    // ズームレベル条件: 最大(21)と最大-1(20)以外で表示
    // つまり zoom < 20 の時に表示
    // layout === "page" (相談ページ) の場合は常に表示したいかもしれないが、
    // ここではマップ上のチップとしてのロジックなので、floating時のみズーム考慮
    if (layout === "floating" && currentZoom !== undefined && currentZoom >= 20) {
      return [];
    }

    if (isShopIntro && current?.shopId) {
      const shop = shopLookup.get(current.shopId);
      return getSmartSuggestions(current.text, shop);
    }
    return getSmartSuggestions(current.text);
  }, [current, isShopIntro, shopLookup, layout, currentZoom]);

  const inputOffsetPx = isKeyboardOpen ? 0 : 0;
  const inputShiftStyle = { transform: `translateY(${inputOffsetPx}px)` };
  const chatPanelLift =
    layout === "page" ? "translate-y-0" : isChatOpen ? "translate-y-[-60px]" : "translate-y-0";
  const _inputBottomOffset =
    layout === "page"
      ? isKeyboardOpen
        ? Math.max(8, keyboardOffset + 28)
        : 50
      : undefined;
  const bubbleText = isChatOpen
    ? aiBubbleText
    : priorityMessage
    ? priorityMessage.text
    : current.text;
  const bubbleIcon = isChatOpen
    ? "🤖"
    : priorityMessage?.badgeIcon ?? current.icon ?? pickCommentIcon(current);
  const activeConsultExample = consultExampleQuestions[consultExampleIndex % consultExampleQuestions.length];
  const activeConsultShop =
    activeConsultContext?.shopId != null ? shopLookup.get(activeConsultContext.shopId) : undefined;
  const consultPlaceholder = activeConsultContext?.shopName
    ? `「${activeConsultContext.shopName}」について聞いてみる`
    : smartContext.placeholder;
  const activeConsultHero =
    CONSULT_CHARACTERS[consultHeroIndex % CONSULT_CHARACTERS.length];
  const preferredCharacter =
    preferredCharacterId ? CONSULT_CHARACTER_BY_ID.get(preferredCharacterId) ?? null : null;
  const isPreferredHero = !!preferredCharacterId && activeConsultHero.id === preferredCharacterId;
  const defaultConsultSpeaker = CONSULT_CHARACTERS[0];
  const getSpeakerCharacter = (speakerId?: ConsultCharacterId) =>
    (speakerId ? CONSULT_CHARACTER_BY_ID.get(speakerId) : null) ?? defaultConsultSpeaker;
  const openSuggestedShopsOnMap = (shopsToOpen: Shop[]) => {
    if (shopsToOpen.length === 0) return;
    saveAiMapPayload({
      ids: shopsToOpen.map((shop) => shop.id),
      label: "AIおすすめ",
    });
    router.push(`/map?ai=1&label=${encodeURIComponent("AIおすすめ")}&shop=${shopsToOpen[0].id}`);
  };
  const renderSuggestedShopsHeader = (suggestedShops: Shop[]) => (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-[12px] font-bold tracking-[0.08em] text-amber-800">
        おすすめのお店
      </span>
      {layout === "page" && isConsultVariant ? (
        <button
          type="button"
          onClick={() => openSuggestedShopsOnMap(suggestedShops)}
          className="rounded-full border border-pink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-pink-700 transition hover:bg-pink-50"
        >
          マップで確認する
        </button>
      ) : null}
    </div>
  );

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!isConsultVariant) return;
    const timer = window.setInterval(() => {
      setConsultHeroIndex((prev) => (prev + 1) % CONSULT_CHARACTERS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [isConsultVariant]);

  const inputVisible = aiStatus === "idle" || aiStatus === "error";

  return (
    <div className={shellClassName}>
      {layout === "page" && chatMessages.length > 0 && (
        <div className="fixed right-4 top-[79px] z-[1500]">
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={() => {
              if (window.confirm("これまでの会話を消してもいいですか？")) {
                setChatMessages([]);
                setHasUserAsked(false);
                setConversationSummary("");
                setErrorNotice(null);
                setErrorCode(null);
                setErrorHelperQuestions([]);
                setLastFailedSubmission(null);
                setActiveConsultContext(null);
                onClear?.();
                if (chatStorageKeyRef.current) {
                  localStorage.removeItem(chatStorageKeyRef.current);
                }
              }
            }}
            className="h-auto rounded-full border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur"
          >
            最初から話す
          </Button>
        </div>
      )}

      <div className={`${containerClassName} transition-transform duration-300 ${chatLiftClassName}`}>
        {showAvatarButton && (
          <div
            className="relative shrink-0 z-[2000]"
            style={{
              transform: `translate(${avatarOffset.x}px, ${avatarOffset.y + (isChatOpen ? -15 : 0)}px)`,
            }}
          >
            <div className={labelClassName}>
              <span className={`grandma-title-label relative -top-[4px] z-[2001] inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 font-semibold text-white ${isConsultVariant ? "bg-slate-700" : "bg-amber-500 shadow-sm"}`}>
                {titleLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              {...handlers}
              className={`${avatarClassName} relative z-0 pointer-events-auto grandma-avatar`}
              style={{ touchAction: "none", WebkitTouchCallout: "none", userSelect: "none" }}
              aria-label="おばあちゃんに相談する"
            >
              {isHolding && <span className="grandma-hold-glow" aria-hidden="true" />}
              <div className="absolute inset-1 overflow-hidden rounded-xl bg-transparent">
                <img
                  src={defaultConsultSpeaker.image}
                  alt="おせっかいばあちゃん"
                  className="h-full w-full scale-110 object-cover object-center select-none"
                  draggable={false}
                />
              </div>
            </button>
          </div>
        )}


        {isChatOpen ? (
          <div
            className={`${bubbleBaseClassName} ${bubbleBorderClass} ${bubbleStateClass}`}
            aria-label="おばあちゃんとの会話"
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className={`text-sm font-semibold ${isConsultVariant ? "text-slate-700" : "text-amber-800"}`}>
                {isConsultVariant ? "AIキャラに相談する" : "にちよさんAI"}
              </div>
              <div className="flex items-center gap-3">
                {aiStatus !== "idle" && (
                  <Badge variant="secondary" className="text-[11px]">
                    {aiStatus === "thinking" ? "考え中…" : "続けて聞いてね"}
                  </Badge>
                )}
              </div>
            </div>
              <ScrollArea
                ref={chatScrollRef}
                className={`mt-2 flex flex-col gap-4 pr-1 ${
                  layout === "page"
                    ? "overflow-visible pb-52"
                    : "max-h-[calc(100vh-240px)]"
                }`}
              >
                <div className={`flex flex-col items-center justify-center gap-2 opacity-90 ${embedded ? "py-4" : "py-8"}`}>
                  <div
                    className={`overflow-hidden rounded-[2rem] border-4 shadow-sm transition-all duration-500 ${
                      embedded ? "h-20 w-20" : "h-32 w-32"
                    } ${
                      isConsultVariant
                        ? isPreferredHero
                          ? "border-orange-400 bg-[var(--consult-surface)]"
                          : "border-[var(--consult-border)] bg-[var(--consult-surface)]"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <img
                      src={isConsultVariant ? activeConsultHero.image : defaultConsultSpeaker.image}
                      alt={isConsultVariant ? activeConsultHero.name : "にちよさん"}
                      className={`h-full w-full object-cover transition-all duration-500 ${
                        isConsultVariant ? activeConsultHero.imageScale : "scale-110"
                      }`}
                      style={
                        isConsultVariant
                          ? { objectPosition: activeConsultHero.imagePosition }
                          : undefined
                      }
                      draggable={false}
                    />
                  </div>
                  <div className="text-center">
                    <div className={`font-bold ${embedded ? "text-base text-green-700 text-stroke-dark" : "text-lg"} ${isConsultVariant ? (embedded ? "" : "text-slate-700") : "text-amber-800"}`}>
                      {isConsultVariant ? activeConsultHero.name : "にちよさん"}
                    </div>
                    <div className={`text-sm ${embedded ? "text-green-700/90 text-stroke-dark" : "text-gray-600"}`}>
                      {isConsultVariant ? activeConsultHero.subtitle : "日曜市のことをなんでも聞いてね"}
                    </div>
                  </div>
                </div>

              {chatMessages.map((message) => {
                const speakerCharacter = getSpeakerCharacter(message.speakerId);
                const speakerName = message.speakerName ?? speakerCharacter.name;
                return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start items-start gap-2"
                  }`}
                >
                  {message.role === "assistant" && isConsultVariant ? (
                    <div className="flex max-w-[min(48rem,calc(100%-1rem))] items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        <div
                          className={`h-11 w-11 overflow-hidden rounded-full border bg-amber-50 shadow-sm ring-2 ring-white ${
                            preferredCharacterId && speakerCharacter.id === preferredCharacterId
                              ? "border-orange-400"
                              : "border-amber-200"
                          }`}
                        >
                          <img
                            src={speakerCharacter.image}
                            alt={speakerName}
                            className={`h-full w-full object-cover ${speakerCharacter.imageScale}`}
                            style={{ objectPosition: speakerCharacter.imagePosition }}
                            draggable={false}
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2 pl-1">
                          <span className={`text-base font-semibold ${embedded ? "text-green-700 text-stroke-dark" : "text-slate-700"}`}>{speakerName}</span>
                          {message.consultId !== undefined && message.turnIndex !== undefined && message.id !== activeStreamingMessageId && (
                            <div className="ml-auto flex items-center gap-0.5">
                              {ratedMessageIds.has(message.id) ? (
                                <span className="text-[10px] text-slate-300 select-none">評価済み</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void submitFeedback(message.id, 1)}
                                    className="rounded p-0.5 text-slate-300 transition hover:text-nicchyo-primary"
                                    aria-label="役に立った"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                      <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 0 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.9 23.9 0 0 1-1.341 5.974C17.153 16.323 16.072 17 14.9 17h-3.192a3 3 0 0 1-1.341-.317l-2.734-1.366A3 3 0 0 0 6.292 15H5V8h.963c.685 0 1.258-.483 1.612-1.068a4.011 4.011 0 0 0 .166-.281l.531-1.06a2 2 0 0 1 .911-.93l1.55-.775A1 1 0 0 1 11 5v.818L10.036 8H11c.552 0 1 .448 1 1v-5.182L11 3Z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setThumbsDownOpenId((prev) => prev === message.id ? null : message.id)}
                                    className={`rounded p-0.5 transition ${thumbsDownOpenId === message.id ? "text-rose-400" : "text-slate-300 hover:text-rose-400"}`}
                                    aria-label="改善が必要"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                                      <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 0 1 2.5 0v7.5ZM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 5.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.243 0-2.261-1.01-2.146-2.247a23.9 23.9 0 0 1 1.341-5.974C2.752 3.677 3.833 3 5.005 3h3.192a3 3 0 0 1 1.341.317l2.734 1.366A3 3 0 0 0 13.613 5h1.292v7h-.963c-.685 0-1.258.483-1.612 1.068a4.01 4.01 0 0 0-.166.281l-.531 1.06a2 2 0 0 1-.911.93l-1.55.775A1 1 0 0 1 8.905 15v-.818l.964-2.182H8.905a1 1 0 0 1-1-1V17Z" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {thumbsDownOpenId === message.id && !ratedMessageIds.has(message.id) && (
                          <div className="mb-2 flex items-center gap-1.5 pl-1">
                            <input
                              type="text"
                              value={thumbsDownComments[message.id] ?? ""}
                              onChange={(e) => setThumbsDownComments((prev) => ({ ...prev, [message.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  void submitFeedback(message.id, -1, thumbsDownComments[message.id]);
                                }
                              }}
                              placeholder="改善点を教えてください（任意）"
                              maxLength={200}
                              className="h-7 flex-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] text-slate-600 placeholder:text-slate-300 focus:border-rose-300 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void submitFeedback(message.id, -1, thumbsDownComments[message.id])}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-100"
                            >
                              送信
                            </button>
                          </div>
                        )}
                        <MessageBubble
                          role={message.role}
                          variant="consult"
                          className="max-w-none shadow-sm"
                        >
                          {message.text}
                          {(() => {
                            const suggestedShops =
                              message.shops && message.shops.length > 0
                                ? message.shops
                                : (message.shopIds ?? [])
                                    .map((id) => shopLookup.get(id))
                                    .filter((shop): shop is Shop => !!shop);
                            if (suggestedShops.length === 0) return null;
                            return (
                              <div className="mt-3 rounded-[1.4rem] border border-amber-200 bg-[#fffaf3] p-3">
                                {renderSuggestedShopsHeader(suggestedShops)}
                                <div className="mt-2 space-y-2">
                                  {suggestedShops.map((shop) => (
                                    <ConsultShopSuggestionCard
                                      key={shop.id}
                                      shop={shop}
                                      onSelectShop={onSelectShop}
                                      onStartConsult={
                                        layout === "page" && isConsultVariant
                                          ? beginShopConsult
                                          : undefined
                                      }
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                          {message.imageUrl && (
                            <button
                              type="button"
                              onClick={() => onAiImageClick?.(message.imageUrl ?? "")}
                              className="mt-3 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md"
                              aria-label="写真を拡大する"
                            >
                              <img
                                src={message.imageUrl}
                                alt="案内画像"
                                className="h-32 w-full object-cover"
                              />
                            </button>
                          )}
                        </MessageBubble>
                        {message.followUpQuestion && (
                          <div className="mt-2 flex flex-wrap gap-2 pl-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleAskSubmit(
                                  message.followUpQuestion,
                                  { source: "suggestion" },
                                  true
                                )
                              }
                              className="rounded-full border border-amber-200 bg-white/90 px-3 py-2 text-[12px] font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                            >
                              {message.followUpQuestion}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0">
                          <div className={`h-10 w-10 overflow-hidden rounded-full border shadow-sm ${isConsultVariant ? "border-[var(--consult-border)] bg-[var(--consult-surface)]" : "border-amber-200 bg-amber-50"}`}>
                            <img
                              src={defaultConsultSpeaker.image}
                              alt="にちよさん"
                              className="h-full w-full scale-110 object-cover object-center"
                              draggable={false}
                            />
                          </div>
                        </div>
                      )}

                      <MessageBubble role={message.role} variant={isConsultVariant ? "consult" : "default"} className="shadow-sm">
                        {message.text}
                        {message.localImageUrl && (
                          <div className="mt-2 overflow-hidden rounded-xl border border-amber-100 bg-white">
                            <img
                              src={message.localImageUrl}
                              alt="送信画像"
                              className="h-28 w-full object-cover"
                            />
                          </div>
                        )}
                        {message.role === "assistant" &&
                          (() => {
                            const suggestedShops =
                              message.shops && message.shops.length > 0
                                ? message.shops
                                : (message.shopIds ?? [])
                                    .map((id) => shopLookup.get(id))
                                    .filter((shop): shop is Shop => !!shop);
                            if (suggestedShops.length === 0) return null;
                            return (
                            <div className="mt-3 rounded-[1.2rem] border border-amber-200 bg-[#fffaf3] p-3">
                              {renderSuggestedShopsHeader(suggestedShops)}
                              <div className="mt-2 space-y-2">
                                {suggestedShops.map((shop) => (
                                  <ConsultShopSuggestionCard
                                    key={shop.id}
                                    shop={shop}
                                    onSelectShop={onSelectShop}
                                    onStartConsult={
                                      layout === "page" && isConsultVariant
                                        ? beginShopConsult
                                        : undefined
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                            );
                          })()}
                        {message.imageUrl && (
                          <button
                            type="button"
                            onClick={() => onAiImageClick?.(message.imageUrl ?? "")}
                            className="mt-3 overflow-hidden rounded-xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md"
                            aria-label="写真を拡大する"
                          >
                            <img
                              src={message.imageUrl}
                              alt="案内画像"
                              className="h-32 w-full object-cover"
                            />
                          </button>
                        )}
                      </MessageBubble>
                    </>
                  )}
                </div>
              )})}
              {aiStatus === "thinking" && !activeStreamingMessageId && (
                isConsultVariant ? (
                  <ThinkingDiscussion data={thinkingData} />
                ) : (
                  <div className="flex justify-start items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 overflow-hidden rounded-full border shadow-sm ${isConsultVariant ? "border-[var(--consult-border)] bg-[var(--consult-surface)]" : "border-amber-200 bg-amber-50"}`}>
                        <img
                          src={defaultConsultSpeaker.image}
                          alt="にちよさん"
                          className="h-full w-full scale-110 object-cover object-center"
                          draggable={false}
                        />
                      </div>
                    </div>
                    <div className="relative max-w-[80%] rounded-2xl rounded-tl-sm border border-amber-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300 border-t-transparent"
                          aria-label="考え中"
                        />
                        <span className="text-xs text-gray-500">考え中…</span>
                      </div>
                    </div>
                  </div>
                )
              )}
            </ScrollArea>
              {layout !== "page" && showScrollToBottom && (
                <button
                type="button"
                onClick={() => {
                  if (chatScrollRef.current) {
                    chatScrollRef.current.scrollTo({
                      top: chatScrollRef.current.scrollHeight,
                      behavior: "smooth"
                    });
                  }
                }}
                className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                aria-label="一番下へスクロール"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
          onClick={
            priorityMessage
              ? onPriorityClick
              : () => {
                    if (isShopIntro) {
                      if (current?.shopId) {
                        onCommentShopFocus?.(current.shopId);
                      }
                      return;
                    }
                    handleNext();
                  }
          }
            className={`${bubbleBaseClassName} ${bubbleBorderClass} ${bubbleStateClass}`}
            aria-label="おばあちゃんのつぶやきを見る"
          >
            {!fullWidth && (
              <>
                <div className="absolute -left-3 bottom-6 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-amber-400" />
                <div className="absolute -left-2 bottom-6 h-0 w-0 border-y-7 border-y-transparent border-r-7 border-r-white" />
              </>
            )}

            <div className="grandma-bubble-content flex items-center gap-3">
              {showIntroImage ? (
                <span className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-transparent" aria-hidden="true">
                  <img
                    src={introImageUrl ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </span>
              ) : showBubbleAvatar ? (
                <span className="h-20 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-transparent" aria-hidden="true">
                  <img
                    src={defaultConsultSpeaker.image}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </span>
              ) : (
                <span className="text-xl" aria-hidden>
                  {bubbleIcon}
                </span>
              )}
              <div key={current.id} className="grandma-comment-bounce space-y-1">
                {isShopIntro ? (
                  (() => {
                    const [title, ...rest] = bubbleText.split("\n");
                    return (
                      <div className="text-gray-900">
                        <div className="text-lg font-semibold">{title}</div>
                        <div className="whitespace-pre-line text-base leading-relaxed">
                          {rest.join("\n")}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <p className="grandma-comment-text text-2xl leading-relaxed text-gray-900">
                    {bubbleText}
                  </p>
                )}
                {current.link && !priorityMessage && !isChatOpen && (
                  <Link
                    href={current.link.href}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline decoration-amber-400 decoration-2 underline-offset-4 transition group-hover:text-amber-700"
                  >
                    {current.link.label}
                    <span aria-hidden>→</span>
                  </Link>
                )}
                {priorityMessage && !isChatOpen && (
                  <p className="text-[11px] text-gray-500">最新バッジの情報</p>
                )}
                {priorityMessage && onPriorityDismiss && !isChatOpen && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPriorityDismiss();
                    }}
                    className="text-[11px] font-semibold text-amber-700 underline"
                  >
                    閉じる
                  </button>
                )}
              </div>
            </div>
          </button>
        )}
      </div>

      {showIntroImage && isIntroImageOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 px-4 pointer-events-auto">
          <div
            className="absolute inset-0"
            onClick={() => {
              setIsIntroImageOpen(false);
              setIntroLockUntil(Date.now() + 3000);
            }}
          />
          <div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-200 bg-white shadow-2xl pointer-events-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setIsIntroImageOpen(false);
                setIntroLockUntil(Date.now() + 3000);
              }}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-amber-100 bg-white/90 text-lg font-bold text-amber-700 shadow-sm hover:bg-amber-50"
              aria-label="閉じる"
            >
              ×
            </button>
            <img
              src={introImageUrl ?? ""}
              alt=""
              className="h-auto w-full object-cover"
              draggable={false}
            />
            <div className="border-t border-amber-100 bg-white px-4 py-3 text-base text-gray-700">
              {bubbleText}
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => {
                  if (current?.shopId) {
                    onCommentShopOpen?.(current.shopId);
                  }
                  setIsIntroImageOpen(false);
                  setIntroLockUntil(Date.now() + 3000);
                }}
                className="w-full rounded-xl bg-amber-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-amber-200/70 transition hover:bg-amber-500"
              >
                このお店をくわしく
              </button>
            </div>
          </div>
        </div>
      )}

        <div
          className={`w-full px-3 transition-all duration-200 ${
            layout === "page"
              ? "sticky z-[1405]"
              : chatPanelLift
          } ${
            isChatOpen
              ? "pointer-events-auto opacity-100 max-h-[320px] mt-2"
              : "pointer-events-none opacity-0 max-h-0 mt-0 overflow-hidden"
          }`}
          style={layout === "page" ? { bottom: `calc(3.5rem + var(--safe-bottom, 0px) + 0.75rem)` } : undefined}
          aria-hidden={!isChatOpen}
        >
        <div className="mx-auto w-full max-w-xl space-y-2" style={inputShiftStyle}>
          {aiImageUrl && !isChatOpen && (
            <button
              type="button"
              onClick={() => onAiImageClick?.(aiImageUrl)}
              className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm transition hover:shadow-md"
              aria-label="写真を拡大する"
            >
              <img
                src={aiImageUrl}
                alt="案内画像"
                className="h-36 w-full object-cover"
              />
            </button>
          )}
          {displayedSuggestedShops.length > 0 && !isKeyboardOpen && !isChatOpen && (
            <div className={`rounded-[1.8rem] border p-3 shadow-sm translate-y-[5px] ${isConsultVariant ? "border-[var(--consult-border)] bg-[var(--consult-surface)]" : "border-orange-300 bg-white/95"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-base font-bold tracking-[0.12em] ${isConsultVariant ? "text-slate-600" : "text-pink-600"}`}>AIおすすめ</span>
                  <span className="text-lg font-bold text-gray-900">提案されたお店</span>
                </div>
                {layout === "page" && isConsultVariant ? (
                  <button
                    type="button"
                    onClick={() => openSuggestedShopsOnMap(displayedSuggestedShops)}
                    className="rounded-full border border-pink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-pink-700 transition hover:bg-pink-50"
                  >
                    マップで確認する
                  </button>
                ) : null}
              </div>
              {aiStatus === "thinking" ? (
                <div className="mt-6 flex items-center justify-center py-4">
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" aria-label="読み込み中" />
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {displayedSuggestedShops.map((shop) => (
                    <ConsultShopSuggestionCard
                      key={shop.id}
                      shop={shop}
                      onSelectShop={onSelectShop}
                      onStartConsult={
                        layout === "page" && isConsultVariant ? beginShopConsult : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <Card
            className={`${
              isConsultVariant
                ? `rounded-[18px] border border-[var(--consult-border)] p-2 shadow-sm ${embedded ? "bg-white/75" : "bg-white/92"}`
                : "rounded-2xl border-2 border-amber-300 bg-white/95 p-3"
            } ${
              isConsultVariant ? "transition-colors duration-150" : "transition-transform duration-200"
            } ${!isConsultVariant && !isChatOpen ? "scale-95" : "scale-100"}`}
          >
              <div className={`flex flex-col ${isConsultVariant ? "gap-1.5" : "gap-2"}`}>
              {layout === "page" && (activeConsultContext?.shopName || preferredCharacter) && (
                <div className="-mx-1 overflow-x-auto pb-1">
                  <div className="flex min-w-max items-center gap-2 px-1 whitespace-nowrap">
                  {activeConsultContext?.shopName && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-2 py-1">
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-amber-100 bg-white">
                        <img
                          src={
                            activeConsultShop
                              ? getShopBannerImage(
                                  activeConsultShop.category,
                                  activeConsultShop.position ?? activeConsultShop.id
                                )
                              : getShopBannerImage("その他", 0)
                          }
                          alt={activeConsultContext.shopName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="max-w-[180px] truncate text-[12px] font-semibold text-amber-900">
                        {activeConsultContext.shopName} を相談中
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveConsultContext(null)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-white text-[13px] font-semibold leading-none text-amber-800 transition hover:bg-amber-100"
                        aria-label="お店相談を解除"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {preferredCharacter && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/70 px-2 py-1">
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-orange-300 bg-white">
                        <img
                          src={preferredCharacter.image}
                          alt={preferredCharacter.name}
                          className={`h-full w-full object-cover ${preferredCharacter.imageScale}`}
                          style={{ objectPosition: preferredCharacter.imagePosition }}
                          draggable={false}
                        />
                      </div>
                      <span className="max-w-[130px] truncate text-[12px] font-semibold text-orange-900">
                        推し: {preferredCharacter.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPreferredCharacterPickerOpen(true)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-orange-200 bg-white text-[13px] font-semibold leading-none text-orange-800 transition hover:bg-orange-100"
                        aria-label="推しキャラを変更"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
              {inputVisible && (<>
              <div
                className={`transition-all duration-200 ${
                  showConsultExamples ? "max-h-12 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                }`}
                aria-hidden={!showConsultExamples}
              >
                {layout === "page" && activeConsultExample && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPreferredCharacterPickerOpen(true)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-[12px] font-semibold shadow-inner transition ${
                        preferredCharacter
                          ? "border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100"
                          : isConsultVariant
                            ? "border-[var(--consult-border)] bg-slate-50/80 text-slate-600 hover:bg-white"
                            : "border-amber-100 bg-white/80 text-amber-600 hover:border-amber-200 hover:bg-amber-50/70"
                      }`}
                    >
                      {preferredCharacter ? `推し: ${preferredCharacter.name}` : "推しキャラ選択"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAskSubmit(activeConsultExample, { source: "suggestion" })}
                      className={`group inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[12px] text-slate-500 shadow-inner transition ${isConsultVariant ? "border-[var(--consult-border)] bg-slate-50/80 hover:bg-white" : "border-amber-100 bg-white/80 hover:border-amber-200 hover:bg-amber-50/70"}` }
                      aria-label={`質問例: ${activeConsultExample}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className={`text-[12px] font-semibold ${isConsultVariant ? "text-slate-600" : "text-amber-600"}`}>例</Badge>
                        <span className="truncate text-slate-600">{activeConsultExample}</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-end gap-1.5">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (isConsultVariant) {
                      // Quick walk-plan prompt flow for MVP
                      const stopsStr = window.prompt("何件立ち寄りたいですか？(例: 2)", "3");
                      if (!stopsStr) return;
                      const stops = Math.max(1, Math.min(6, Number(stopsStr) || 3));
                      const startAt = window.prompt("開始時刻を教えてください（例: 10:00、または 今すぐ）", "今すぐ") || "今すぐ";
                      const interest = window.prompt("興味のあることを入力してください（例: 食べ物、工芸、写真など）", "") || "";
                      const candidates = displayedSuggestedShops.length > 0 ? displayedSuggestedShops : aiSuggestedShops ?? [];
                      const selected = candidates.slice(0, Math.min(stops, candidates.length));
                      const now = new Date();
                      const planShops = selected.map((s, i) => ({ id: s.id, name: s.name, time: new Date(now.getTime() + i * 20 * 60 * 1000).toISOString() }));
                      const plan = { title: `${startAt}のおさんぽプラン`, summary: interest, shops: planShops };
                      try {
                        localStorage.setItem('nicchyo-walk-plan', JSON.stringify(plan));
                      } catch {}
                      setChatMessages((prev) => [
                        ...prev,
                        {
                          id: `assistant-plan-${Date.now()}`,
                          role: 'assistant',
                          text: `おさんぽプランを作成したよ。マップで確認してみてね。`,
                          shops: selected,
                          plan,
                        },
                      ]);
                      // Navigate to map with walkPlan flag so map will load it
                      router.push('/map?walkPlan=1');
                    } else {
                      imageInputRef.current?.click();
                    }
                  }}
                  className={`${
                    isConsultVariant
                      ? `h-11 w-11 rounded-full border-[var(--consult-border)] text-lg font-semibold text-slate-600 ${embedded ? "bg-white/50 hover:bg-white/70" : "bg-slate-50 hover:bg-white"}`
                      : "border-amber-200 bg-white text-lg font-semibold text-amber-700 hover:bg-amber-50"
                  }`}
                  aria-label="写真を選ぶ"
                >
                  {isConsultVariant ? "＋" : "+"}
                </Button>
                <Textarea
                  ref={inputRef}
                  value={askText}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setAskText(nextValue);
                    if (errorNotice) {
                      setErrorNotice(null);
                      setLastFailedSubmission(null);
                    }
                    if (shouldValidateInput && nextValue.trim()) {
                      setShouldShowValidation(false);
                    }
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    setIsInputFocused(false);
                    if (shouldValidateInput && !askText.trim() && !selectedImageFile) {
                      setShouldShowValidation(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskSubmit();
                    }
                  }}
                  rows={isConsultVariant ? 1 : 2}
                  className={`min-h-[38px] max-h-24 resize-none ${
                    isConsultVariant
                      ? `min-h-[46px] rounded-[16px] border-[var(--consult-border)] px-3 py-3 text-base text-gray-900 focus-visible:ring-slate-300 ${embedded ? "bg-white/60 placeholder:text-gray-500" : "bg-white"}`
                      : "border-amber-200 bg-white text-gray-900 focus-visible:ring-amber-400"
                  }`}
                  placeholder={consultPlaceholder}
                />
                {enableSpeechInput && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={startSpeechRecognition}
                    disabled={!isSpeechSupported}
                    className={`${
                      !isSpeechSupported
                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                      : isListening
                        ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                      : isConsultVariant
                            ? "h-9 w-9 rounded-full border-[var(--consult-border)] bg-slate-50 text-slate-700 hover:bg-white"
                            : "border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                    }`}
                    aria-label={isListening ? "音声入力を停止" : "音声入力を開始"}
                  >
                    {isListening ? (
                      <span className="text-sm font-semibold">■</span>
                    ) : (
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon"
                  onClick={() => handleAskSubmit()}
                  className={`${
                    isConsultVariant
                        ? "h-9 w-9 rounded-full border-[var(--consult-border)] bg-slate-700 text-white hover:bg-slate-600"
                        : "border-amber-200 bg-amber-600 text-white hover:bg-amber-500"
                  }`}
                  aria-label="メッセージを送る"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </Button>
              </div>
              {enableSpeechInput && !isSpeechSupported && (
                <div className="text-[13px] text-slate-500">
                  音声入力は対応ブラウザのみ
                </div>
              )}
              {enableSpeechInput && isListening && (
                <Badge variant="destructive" className="w-fit gap-2 text-[12px]">
                  <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                  音声入力中
                </Badge>
              )}
              {selectedImageName && (
                <div className="text-[13px] text-slate-600">
                  画像: {selectedImageName}
                </div>
              )}
              {errorNotice && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{errorNotice}</span>
                    {lastFailedSubmission && (
                      <Button
                        type="button"
                        variant="outline"
                        size="default"
                        onClick={() =>
                          handleAskSubmit(
                            lastFailedSubmission.text,
                            lastFailedSubmission.context,
                            true,
                            lastFailedSubmission
                          )
                        }
                        className="h-9 rounded-full border-rose-200 bg-white px-3 text-[13px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        もう一度送る
                      </Button>
                    )}
                  </div>
                  {!lastFailedSubmission && errorCode && errorCode !== "system_error" && errorHelperQuestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {errorHelperQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() =>
                            handleAskSubmit(question, { source: "suggestion" }, true)
                          }
                          className="rounded-full border border-rose-200 bg-white px-3 py-2 text-[13px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {shouldShowValidation && (
                <div className="text-[13px] font-semibold text-rose-500">
                  質問内容を入力するか写真を選んでね。
                </div>
              )}
              </>)}
            </div>
          </Card>
        </div>
      </div>
      {layout === "page" && isPreferredCharacterPickerOpen && (
        <div className="fixed inset-0 z-[1700] flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-amber-100 bg-white p-5 shadow-2xl lg:max-w-[1180px]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-bold text-slate-900">推しキャラ選択</div>
                <div className="text-sm text-slate-500">選んだキャラは毎回キャラ1として登場します。</div>
              </div>
              <button
                type="button"
                onClick={() => setIsPreferredCharacterPickerOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                閉じる
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => {
                  onPreferredCharacterChange?.(null);
                  setIsPreferredCharacterPickerOpen(false);
                }}
                className={`rounded-[1.5rem] border p-4 text-left transition ${
                  preferredCharacterId === null
                    ? "border-orange-400 bg-orange-50"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="text-base font-semibold text-slate-900">おまかせ</div>
                <div className="mt-1 text-sm text-slate-500">毎回ランダムで選びます</div>
              </button>
                {CONSULT_CHARACTERS.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => {
                      onPreferredCharacterChange?.(character.id);
                      setIsPreferredCharacterPickerOpen(false);
                    }}
                    className={`rounded-[1.5rem] border p-3 text-left transition lg:min-w-[210px] ${
                      preferredCharacterId === character.id
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-200 bg-white hover:bg-amber-50"
                  }`}
                >
                  <div className="mx-auto h-24 w-24 overflow-hidden rounded-[1.25rem] border border-amber-100 bg-amber-50">
                    <img
                      src={character.image}
                      alt={character.name}
                      className={`h-full w-full object-cover ${character.imageScale}`}
                      style={{ objectPosition: character.imagePosition }}
                      draggable={false}
                    />
                  </div>
                  <div className="mt-3 text-base font-semibold text-slate-900">{character.name}</div>
                  <div className="mt-1 text-[12px] leading-6 text-slate-500">{character.subtitle}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function pickCommentIcon(comment: { genre: string; text: string }) {
  const text = comment.text;
  if (comment.genre === "event") return "🎉";
  if (comment.genre === "notice") {
    if (text.includes("バッグ") || text.includes("bag")) return "👜";
    if (text.includes("ブロック")) return "🧭";
    return "⚠️";
  }
  if (comment.genre === "tutorial") {
    if (text.includes("検索") || text.includes("探")) return "🔎";
    return "👆";
  }

  if (text.includes("雨")) return "☔";
  if (text.includes("風")) return "🌬️";
  if (text.includes("夕方")) return "🌇";
  if (text.includes("朝")) return "🌅";
  if (text.includes("写真")) return "📸";
  if (text.includes("城") || text.includes("城下町")) return "🏯";
  if (text.includes("季節")) return "🍁";
  if (text.includes("果物")) return "🍊";
  if (text.includes("野菜") || text.includes("食材")) return "🥬";
  if (text.includes("飲み物")) return "🥤";
  if (text.includes("甘い")) return "🍡";
  if (text.includes("屋台") || text.includes("お腹") || text.includes("料理") || text.includes("食べ")) return "🍽️";
  if (text.includes("休") || text.includes("座") || text.includes("ベンチ")) return "🪑";
  if (text.includes("音楽")) return "🎵";
  if (text.includes("迷子") || text.includes("人が多い")) return "👥";
  if (text.includes("お土産") || text.includes("お気に入り")) return "🎁";
  if (text.includes("道") || text.includes("散歩") || text.includes("歩")) return "🚶";
  if (text.includes("時間") || text.includes("早め")) return "⏰";

  return "💬";
}

function ConsultShopSuggestionCard({
  shop,
  onSelectShop,
  onStartConsult,
}: {
  shop: Shop;
  onSelectShop?: (shopId: number, shop?: Shop) => void;
  onStartConsult?: (shop: Shop) => void;
}) {
  const previewImage =
    shop.images?.main ||
    shop.images?.thumbnail ||
    shop.images?.additional?.[0] ||
    getShopBannerImage(shop.category, shop.position ?? shop.id);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelectShop?.(shop.id, shop)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectShop?.(shop.id, shop);
        }
      }}
      className="relative w-full cursor-pointer overflow-hidden rounded-[1.35rem] border border-amber-200 bg-white text-left shadow-sm transition hover:bg-amber-50/40"
      aria-label={`${shop.name}のショップバナーを開く`}
    >
      <div className="relative h-32 w-full overflow-hidden border-b border-amber-100 bg-amber-50">
        <img
          src={previewImage}
          alt={`${shop.name}の画像`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 pb-3 pt-6">
          <div className="truncate text-base font-semibold text-white">{shop.name}</div>
          <div className="mt-0.5 text-[12px] text-white/85">{shop.ownerName}</div>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-amber-800 shadow-sm">
          #{shop.id}
        </span>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-800">
            {shop.category}
          </span>
          {shop.products.slice(0, 2).map((product) => (
            <span
              key={`${shop.id}-${product}`}
              className="rounded-full border border-amber-100 bg-amber-50/70 px-2.5 py-1 text-[11px] text-slate-600"
            >
              {product}
            </span>
          ))}
        </div>
        <div className="line-clamp-2 text-[13px] leading-6 text-slate-600">
          {shop.products.join("・")}
        </div>
        <div className="flex items-center justify-end gap-3 sm:justify-between">
          <span className="hidden text-[12px] font-medium text-slate-500 sm:inline">
            タップでお店の詳細を見る
          </span>
          {onStartConsult && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartConsult(shop);
              }}
              className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              このお店について詳しく
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GrandmaChatter;
