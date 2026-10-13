"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import NavigationBar from "../../components/NavigationBar";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import ConsultStage from "./components/ConsultStage";
import {
  CONSULT_CHARACTER_BY_ID,
  DEFAULT_CONSULT_CHARACTER_ID,
  type ConsultCharacterId,
} from "./data/consultCharacters";
import type {
  ConsultAskResponse,
  ConsultAskStreamEvent,
  ConsultHistoryEntry,
} from "./types/consultConversation";
import type { Shop } from "../map/data/shops";
import { getOrCreateConsultVisitorKey } from "@/lib/consultVisitorKey";
import { readConsultAskResponse } from "./utils/readConsultAskResponse";

const PREFERRED_CHARACTER_STORAGE_KEY = "nicchyo-consult-preferred-character";

export default function ConsultClient() {
  const [knownShops, setKnownShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  // 既定はにちよさん。null にすると話し手が毎回変わり、会話全体が掛け合いに見える
  const [preferredCharacterId, setPreferredCharacterId] =
    useState<ConsultCharacterId>(DEFAULT_CONSULT_CHARACTER_ID);
  // 「これまでの相談」サイドバー（PC・モバイル共通）の開閉。既定は閉じ、チャット欄を中央のまま保つ
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(false);
  const searchParams = useSearchParams();

  const handleSelectShop = useCallback(
    (shopId: number, shopFromCard?: Shop) => {
      const shop = shopFromCard ?? knownShops.find((item) => item.id === shopId) ?? null;
      if (shop) setSelectedShop(shop);
    },
    [knownShops]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(PREFERRED_CHARACTER_STORAGE_KEY);
    // 消えたキャラのIDが残っていても既定に落ちるようにする
    if (!saved || !CONSULT_CHARACTER_BY_ID.has(saved as ConsultCharacterId)) return;
    setPreferredCharacterId(saved as ConsultCharacterId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
      const result = await readConsultAskResponse(response, onEvent);
      if (result) {
        return normalizeAskResponse(result.payload, result.ok);
      }

      return {
        reply: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
        errorCode: "system_error",
        errorMessage: "返答の取得に失敗しました。もう一度お試しください。",
        retryable: true,
      };
    } catch {
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
      // チャットのスクロールは ConsultStage 内側の overflow-y-auto だけで完結させたい。
      // ここに overflow-hidden を付けておかないと、何かの拍子に中身が 100dvh を
      // わずかに超えたときページ本体（html）側にもスクロールバーが出て、意図した
      // チャット用スクロールバーの隣にもう1本（グローバル装飾で同じ緑色の）スクロール
      // バーが並んで見えてしまう
      // 「マップにもどる」バーは上に置く（スマホは上端の細い帯、lg 以上は右上の小さなバー）。
      // 下端にナビの分の余白は要らないので --nav-bar-height を 0 にし、相談の下端まわりの計算
      // （入力欄の位置・スクロール領域の高さ）がそれに追従するようにする。
      // 上端の帯の分は --consult-top-space で空ける（lg 以上は帯ではないので 0）
      className="relative min-h-screen overflow-hidden bg-[var(--consult-bg)] [--consult-top-space:3rem] [--nav-bar-height:0px] lg:[--consult-top-space:0px]"
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-[var(--consult-bg)]" aria-hidden="true" />
      {/*
        「これまでの相談」サイドバー（lg 以上）を開いているときは、
        サイドバーのすぐ右（固定ガター lg:pl-80）から本文を始める。

        ここでは幅を max-w-3xl に絞らない（ConsultStage に w-full のまま渡す）。
        絞ってしまうと、その狭い箱の内側でスクロールすることになり、縦スクロール
        バーが画面の右端ではなく「箱の右端＝画面中央寄りの中途半端な位置」に
        出てしまう（サイドバーを開いて本文が中央からずれるとなおさら目立つ）。
        読みやすい行幅への制限と中央/左寄せの切り替えは、スクロール領域の
        内側（ConsultStage 側の内側ラッパー）で行い、スクロールする箱自体は
        画面の右端まで届く幅にしておく。

        同じ理由で左右の px も持たせない（横方向の余白は ConsultStage 側の
        内側ラッパーが px-4 で持つ）。ここに px を付けると、スクロールする箱の
        右端が画面の真の右端から px 分だけ内側にずれ、チャットのスクロールバーが
        画面端にぴったり付かなくなる
      */}
      <main
        // サイドバーの開け閉めに合わせて、本文の左の空きも滑らかに広げ・縮める
        // （サイドバー側の動きと同じ速さ・緩急。ConsultStage の HISTORY_SIDEBAR_SLIDE_*）
        className={`relative z-10 w-full pb-16 pt-[var(--consult-top-space)] motion-safe:transition-[padding-left] motion-safe:duration-300 motion-safe:ease-out-soft ${
          isHistorySidebarOpen ? "lg:pl-80" : ""
        }`}
      >
        <div className="w-full">
          {/* 現地でスマホを片手に使う前提の画面。相談はこの形に一本化した */}
          <ConsultStage
            onAskStream={handleGrandmaAskStream}
            allShops={knownShops}
            onSelectShop={handleSelectShop}
            autoAskText={autoAskText}
            autoAskContext={autoAskContext}
            preferredCharacterId={preferredCharacterId}
            onPreferredCharacterChange={setPreferredCharacterId}
            isHistorySidebarOpen={isHistorySidebarOpen}
            onHistorySidebarOpenChange={setIsHistorySidebarOpen}
          />
        </div>
      </main>
      {selectedShop && <ShopDetailBanner shop={selectedShop} onClose={() => setSelectedShop(null)} />}
      <NavigationBar activeHref="/consult" backBarOnTop />
    </div>
  );
}
