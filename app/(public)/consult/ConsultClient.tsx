"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import NavigationBar from "../../components/NavigationBar";
import GrandmaChatter from "../map/components/GrandmaChatter";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import { grandmaComments } from "../map/data/grandmaComments";
import type { ConsultCharacterId } from "./data/consultCharacters";
import type {
  ConsultAskResponse,
  ConsultAskStreamEvent,
  ConsultHistoryEntry,
} from "./types/consultConversation";
import type { Shop } from "../map/data/shops";
import { getOrCreateConsultVisitorKey } from "@/lib/consultVisitorKey";

const PREFERRED_CHARACTER_STORAGE_KEY = "nicchyo-consult-preferred-character";

export default function ConsultClient({ embedded = false }: { embedded?: boolean }) {
  const [aiSuggestedShops, setAiSuggestedShops] = useState<Shop[]>([]);
  const [knownShops, setKnownShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [preferredCharacterId, setPreferredCharacterId] = useState<ConsultCharacterId | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(PREFERRED_CHARACTER_STORAGE_KEY);
    if (!saved) return;
    setPreferredCharacterId(saved as ConsultCharacterId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!preferredCharacterId) {
      window.localStorage.removeItem(PREFERRED_CHARACTER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(PREFERRED_CHARACTER_STORAGE_KEY, preferredCharacterId);
  }, [preferredCharacterId]);

  const mergeKnownShops = useCallback((shops: Shop[] | undefined) => {
    if (!shops || shops.length === 0) return;
    setKnownShops((prev) => {
      const next = new Map<number, Shop>();
      prev.forEach((shop) => next.set(shop.id, shop));
      shops.forEach((shop) => next.set(shop.id, shop));
      return Array.from(next.values());
    });
  }, []);

  const buildAskRequest = useCallback((
    text: string,
    imageFile?: File | null,
    context?: { shopId?: number; shopName?: string; source?: "suggestion" | "input" },
    history?: ConsultHistoryEntry[],
    memorySummary?: string,
    stream?: boolean
  ) => {
    const visitorKey = getOrCreateConsultVisitorKey();
    const useForm = !!imageFile;
    const body = useForm
      ? (() => {
          const form = new FormData();
          form.append("text", text);
          form.append("location", JSON.stringify(null));
          if (context?.shopId) form.append("shopId", String(context.shopId));
          if (context?.shopName) form.append("shopName", context.shopName);
          form.append("history", JSON.stringify(history ?? []));
          form.append("memorySummary", memorySummary ?? "");
          if (preferredCharacterId) {
            form.append("preferredCharacterId", preferredCharacterId);
          }
          if (visitorKey) {
            form.append("visitorKey", visitorKey);
          }
          if (stream) {
            form.append("stream", "1");
          }
          if (imageFile) form.append("image", imageFile);
          return form;
        })()
      : JSON.stringify({
          text,
          location: null,
          shopId: context?.shopId ?? null,
          shopName: context?.shopName ?? null,
          history: history ?? [],
          memorySummary: memorySummary ?? "",
          preferredCharacterId,
          visitorKey,
          stream: !!stream,
        });

    return {
      body,
      headers: useForm ? undefined : { "Content-Type": "application/json" as const },
    };
  }, [preferredCharacterId]);

  const normalizeAskResponse = useCallback((
    payload: {
      reply?: string;
      imageUrl?: string;
      shopIds?: number[];
      shops?: Shop[];
      turns?: ConsultAskResponse["turns"];
      followUpQuestion?: string;
      memorySummary?: string;
      errorCode?: ConsultAskResponse["errorCode"];
      helperQuestions?: string[];
      errorMessage?: string;
      retryable?: boolean;
      consultId?: string;
    },
    ok: boolean
  ): ConsultAskResponse => {
    mergeKnownShops(payload.shops);
    if (payload.shops && payload.shops.length > 0) {
      setAiSuggestedShops(payload.shops);
    } else {
      setAiSuggestedShops([]);
    }

    return {
      reply:
        payload.reply ??
        "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
      imageUrl: payload.imageUrl,
      shopIds: payload.shopIds,
      shops: payload.shops,
      turns: payload.turns,
      followUpQuestion: payload.followUpQuestion,
      memorySummary: payload.memorySummary,
      errorCode: ok ? payload.errorCode : payload.errorCode ?? "system_error",
      helperQuestions: payload.helperQuestions,
      errorMessage:
        payload.errorMessage ??
        (ok
          ? undefined
          : "相談の送信に失敗しました。通信状況を確認して、もう一度試してください。"),
      retryable: ok
        ? payload.retryable ?? false
        : payload.retryable ?? payload.errorCode === "system_error",
      consultId: payload.consultId,
    };
  }, [mergeKnownShops]);

  const handleGrandmaAsk = useCallback(async (
    text: string,
    imageFile?: File | null,
    context?: { shopId?: number; shopName?: string; source?: "suggestion" | "input" },
    history?: ConsultHistoryEntry[],
    memorySummary?: string
  ): Promise<ConsultAskResponse> => {
    try {
      const { body, headers } = buildAskRequest(
        text,
        imageFile,
        context,
        history,
        memorySummary
      );
      const response = await fetch("/api/grandma/ask", {
        method: "POST",
        headers,
        body,
      });
      const payload = (await response.json()) as Parameters<typeof normalizeAskResponse>[0];
      return normalizeAskResponse(payload, response.ok);
    } catch {
      setAiSuggestedShops([]);
      return {
        reply: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
        errorCode: "system_error",
        errorMessage: "接続に失敗しました。少し時間をおいて、もう一度試してください。",
        retryable: true,
      };
    }
  }, [buildAskRequest, normalizeAskResponse]);

  const handleGrandmaAskStream = useCallback(async (
    text: string,
    imageFile?: File | null,
    context?: { shopId?: number; shopName?: string; source?: "suggestion" | "input" },
    history?: ConsultHistoryEntry[],
    memorySummary?: string,
    onEvent?: (event: ConsultAskStreamEvent) => void
  ): Promise<ConsultAskResponse> => {
    try {
      const { body, headers } = buildAskRequest(
        text,
        imageFile,
        context,
        history,
        memorySummary,
        true
      );
      const response = await fetch("/api/grandma/ask", {
        method: "POST",
        headers,
        body,
      });
      if (!response.ok) {
        const payload = (await response.json()) as Parameters<typeof normalizeAskResponse>[0];
        return normalizeAskResponse(payload, false);
      }
      if (!response.body) {
        throw new Error("stream body not found");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResponse: ConsultAskResponse | null = null;

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const event = JSON.parse(trimmed) as ConsultAskStreamEvent;
        onEvent?.(event);
        if (event.type === "final") {
          finalResponse = normalizeAskResponse(event.response, true);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
      }

      const trailing = buffer.trim();
      if (trailing) {
        handleLine(trailing);
      }

      return (
        finalResponse ?? {
          reply: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
          errorCode: "system_error",
          errorMessage: "返答の取得に失敗しました。もう一度お試しください。",
          retryable: true,
        }
      );
    } catch {
      setAiSuggestedShops([]);
      return {
        reply: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
        errorCode: "system_error",
        errorMessage: "接続に失敗しました。少し時間をおいて、もう一度試してください。",
        retryable: true,
      };
    }
  }, [buildAskRequest, normalizeAskResponse]);

  const autoAskText = searchParams?.get("q") || null;
  const autoAskShopIdRaw = searchParams?.get("shopId");
  const autoAskShopId = autoAskShopIdRaw ? Number(autoAskShopIdRaw) : undefined;
  const autoAskShopName = searchParams?.get("shopName") || undefined;
  const autoAskContext =
    autoAskShopId || autoAskShopName
      ? { shopId: Number.isFinite(autoAskShopId) ? autoAskShopId : undefined, shopName: autoAskShopName }
      : undefined;

  return (
    <div
      className={`relative min-h-screen ${embedded ? "bg-transparent" : "bg-[var(--consult-bg)]"}`}
    >
      {!embedded && <div className="pointer-events-none absolute inset-0 z-0 bg-[var(--consult-bg)]" aria-hidden="true" />}
      <main className="relative z-10 flex w-full items-start justify-center px-3 pb-16 pt-2">
        <div className="flex w-full max-w-5xl flex-col gap-2">

          {/* ヘッダー：standalone のみ表示 */}
          {!embedded && (
            <section className="flex flex-col items-center gap-3 pb-1 pt-4 text-center">
              <Image
                src="/characters/obaasan.png"
                alt="にちよさん"
                width={180}
                height={180}
                className="h-[120px] w-[120px] object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)] md:h-[180px] md:w-[180px]"
              />
              <div>
                <p className="eyebrow">Nichiyo-san</p>
                <h1 className="mt-1 font-display text-2xl text-amber-900 md:text-3xl">
                  なんでも、聞いてください
                </h1>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                <span className="rounded-full border border-amber-200/70 bg-white/70 px-3 py-1 text-xs font-bold text-amber-800">🎤 音声入力OK</span>
                <span className="rounded-full border border-amber-200/70 bg-white/70 px-3 py-1 text-xs font-bold text-amber-800">📷 写真相談OK</span>
              </div>
            </section>
          )}

          <GrandmaChatter
            titleLabel="にちよさん"
            fullWidth
            variant="consult"
            embedded={embedded}
            comments={grandmaComments}
            onAsk={handleGrandmaAsk}
            onAskStream={handleGrandmaAskStream}
            allShops={knownShops}
            aiSuggestedShops={aiSuggestedShops}
            onSelectShop={(shopId, shopFromCard) => {
              const shop =
                shopFromCard ?? knownShops.find((item) => item.id === shopId) ?? null;
              if (shop) {
                setSelectedShop(shop);
              }
            }}
            initialOpen
            layout="page"
            onClear={() => setAiSuggestedShops([])}
            autoAskText={autoAskText}
            autoAskContext={autoAskContext}
            enableSpeechInput
            preferredCharacterId={preferredCharacterId}
            onPreferredCharacterChange={setPreferredCharacterId}
          />
        </div>
      </main>
      {selectedShop && <ShopDetailBanner shop={selectedShop} onClose={() => setSelectedShop(null)} />}
      {!embedded && <NavigationBar activeHref="/consult" />}
    </div>
  );
}
