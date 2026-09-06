"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Keyboard, Mic, RotateCcw, Send, Square, X } from "lucide-react";
import toast from "react-hot-toast";
import { useSpeechInput } from "@/lib/hooks/useSpeechInput";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import {
  buildHistoryForRequest,
  createEmptySession,
  pickSuggestions,
  importHandoffEntries,
  restoreSession,
  toDateKey,
  type ConsultEntry,
} from "@/lib/grandma/consultSession";
import GrandmaAvatar from "./GrandmaAvatar";
import ConsultShopCard from "./ConsultShopCard";
import type { Shop } from "../../map/data/shops";
import type {
  ConsultAskResponse,
  ConsultAskStreamEvent,
  ConsultHistoryEntry,
} from "../types/consultConversation";

const SESSION_STORAGE_KEY = "nicchyo-consult-session";
/** マップ上の相談から「くわしく相談する」で渡ってくる引き継ぎ（MapCharacterConsult と共有） */
const HANDOFF_STORAGE_KEY = "nicchyo-consult-chat";

/**
 * 現地でよく出る質問。候補ボタンの母集団。
 * ここが「一番速くて、騒音に強くて、API を叩かずに済ませられる」入口になる。
 */
const QUESTION_POOL = [
  "今の季節の旬は何？",
  "混雑を避けるコツは？",
  "子ども連れでも楽しめる？",
  "日曜市の回り方を教えて",
  "お土産におすすめは？",
  "近くで座って休める場所は？",
  "食べ歩きできるものある？",
  "写真映えする場所は？",
] as const;

export interface ConsultStageProps {
  onAskStream: (
    text: string,
    imageFile: File | null | undefined,
    context: { shopId?: number; shopName?: string; source?: "suggestion" | "input" } | undefined,
    history: ConsultHistoryEntry[] | undefined,
    memorySummary: string | undefined,
    onEvent: (event: ConsultAskStreamEvent) => void
  ) => Promise<ConsultAskResponse>;
  allShops?: Shop[];
  onSelectShop?: (shopId: number, shop?: Shop) => void;
  /** ?q= で開かれたときに自動で聞く */
  autoAskText?: string | null;
  /** ?shopId= / ?shopName= 付きで開かれたとき、その店を前提に答えさせる */
  autoAskContext?: { shopId?: number; shopName?: string };
}

type StagePhase = "idle" | "confirming" | "thinking";

/**
 * 現地・スマホ・片手を前提にした相談画面。
 *
 * 会話ログを積み上げず、「今の答え」1枚だけを主役にする。
 * 現地の相談はほぼ全部が独立した1往復で終わり、文脈が積み上がらないため、
 * ログを積むと縦に伸びるだけで得がない（キャラを大きく置く余地も失う）。
 *
 * 入力手段の優先順位は、速さと騒音耐性で決めている：
 *   候補ボタン（0.5秒・騒音に強い） > 音声（3〜5秒・騒音に弱い） > 文字（15秒以上）
 */
export default function ConsultStage({
  onAskStream,
  allShops = [],
  onSelectShop,
  autoAskText,
  autoAskContext,
}: ConsultStageProps) {
  const [entries, setEntries] = useState<ConsultEntry[]>([]);
  const [phase, setPhase] = useState<StagePhase>("idle");
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingSpeaker, setStreamingSpeaker] = useState<string | null>(null);
  /** 応答待ちの間も「何を聞いたか」を出しておくため */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [hasRestored, setHasRestored] = useState(false);
  const [autoAsked, setAutoAsked] = useState(false);
  /**
   * 回答に添えられて返ってきたお店。
   * 店舗そのものは localStorage に保存せず（重いので）ID だけ持ち、
   * 実体はこの表と allShops から引く。
   */
  const [shopsById, setShopsById] = useState<Record<number, Shop>>({});

  const entriesRef = useRef<ConsultEntry[]>([]);
  entriesRef.current = entries;
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  /**
   * にちよさんの大きさは「利用者が読む場所を欲しがっているか」だけで決める。
   *
   * 答えが出たかどうかでは決めない。それだと質問した瞬間に縮んでしまい、
   * 一番動きが効く「考えている」最中に小さくなってしまう。しかも一度縮むと
   * 二度と戻らず、キャラを中心に据えた画面でなくなってしまう。
   *
   * スクロール量を毎フレーム見ると屋外の長時間利用で電池に響くので、
   * 画面最上部の目印が見えているかどうかだけを IntersectionObserver で見る。
   */
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolledDown(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // 認識が終わったら、そのまま送らずに確認へ回す。
  // 日曜市は騒がしく誤認識が避けられないので、黙って送ると
  // 「なぜ変な答えが返ってきたのか」が利用者に分からなくなる。
  const cancellingRef = useRef(false);
  // notifyError は下で定義するので、ref 越しに呼ぶ
  const notifyErrorRef = useRef<
    ((message: string, retry?: { label: string; run: () => void }) => void) | null
  >(null);
  const handleSpeechSettled = useCallback((transcript: string) => {
    // 「やめる」で止めたときは確認へ進めない（stop() でも onend は通るため）
    if (cancellingRef.current) {
      cancellingRef.current = false;
      return;
    }
    if (!transcript) return;
    setDraft(transcript);
    setPhase("confirming");
  }, []);

  const handleSpeechError = useCallback(() => {
    // 何も起きずにシートが消えると壊れたように見えるので、必ず理由を出す
    setPhase("idle");
    notifyErrorRef.current?.(
      "声が聞き取れんかった。マイクの許可を確かめるか、文字で聞いてみてね。"
    );
  }, []);

  const speech = useSpeechInput({
    onSettled: handleSpeechSettled,
    onError: handleSpeechError,
  });

  const pose = resolveGrandmaPose({
    isListening: speech.isListening,
    isStreaming: streamingText !== null,
    aiStatus: phase === "thinking" ? "thinking" : "idle",
  });

  // 相談の保存と復元。日付が変わっていれば畳まれる（前の日曜市の相談は残さない）
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const restored = restoreSession(window.localStorage.getItem(SESSION_STORAGE_KEY)).entries;
      // マップ上の相談から遷移してきた分を引き継ぐ（取り込んだら消す）
      const handed = importHandoffEntries(window.localStorage.getItem(HANDOFF_STORAGE_KEY));
      if (handed.length > 0) window.localStorage.removeItem(HANDOFF_STORAGE_KEY);
      setEntries([...handed, ...restored]);
    } catch {
      // サイトデータが読めない設定でも相談は始められるようにする
    }
    setHasRestored(true);
  }, []);

  useEffect(() => {
    if (!hasRestored || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ dateKey: toDateKey(), entries })
      );
    } catch {
      // 保存できなくても相談自体は続けられるので握りつぶす
    }
  }, [entries, hasRestored]);

  /**
   * エラーの知らせ。
   *
   * 以前は答えのカードの下に出していたが、そこは読み進めないと見えない位置で、
   * 下までスクロールしていると気づけなかった。画面の上に出して、
   * 目に入る場所で知らせる。
   *
   * 屋外で読むので、既定の3秒では短い。やり直せるものには手段を添える。
   */
  const notifyError = useCallback(
    (message: string, retry?: { label: string; run: () => void }) => {
      toast.custom(
        (item) => (
          <div
            className={`pointer-events-auto flex w-[min(92vw,26rem)] items-start gap-2.5 rounded-2xl border border-red-200 bg-white px-4 py-3 shadow-lg transition duration-200 ${
              item.visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
            <p className="flex-1 text-sm leading-6 text-slate-700">{message}</p>
            {retry && (
              <button
                type="button"
                onClick={() => {
                  toast.dismiss(item.id);
                  retry.run();
                }}
                className="shrink-0 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white"
              >
                {retry.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => toast.dismiss(item.id)}
              aria-label="閉じる"
              className="shrink-0"
            >
              <X className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
          </div>
        ),
        // 同じ id にして、続けて失敗しても積み上がらないようにする
        { id: "consult-error", duration: 7000, position: "top-center" }
      );
    },
    []
  );
  notifyErrorRef.current = notifyError;

  // QR やリンクから来た店舗の前提は、最初の質問にだけ添える
  const autoAskContextRef = useRef(autoAskContext);
  autoAskContextRef.current = autoAskContext;

  const ask = useCallback(
    async (question: string, source: "suggestion" | "input", withContext = false) => {
      const text = question.trim();
      if (!text || phase === "thinking") return;

      toast.dismiss("consult-error");
      setPhase("thinking");
      setDraft("");
      setPendingQuestion(text);
      setStreamingText(null);
      setStreamingSpeaker(null);

      const history = buildHistoryForRequest(entriesRef.current);

      const handleEvent = (event: ConsultAskStreamEvent) => {
        if (event.type === "first_turn_start") {
          setStreamingSpeaker(event.speakerName);
          setStreamingText("");
        } else if (event.type === "first_turn_delta") {
          setStreamingText((prev) => `${prev ?? ""}${event.delta}`);
        }
      };

      try {
        const response = await onAskStream(
          text,
          null,
          { source, ...(withContext ? autoAskContextRef.current : undefined) },
          history,
          undefined,
          handleEvent
        );

        // 失敗した回答を相談として残さない。残すと、お詫び文が答えとして保存され、
        // 次のリクエストの履歴に混ざり、その質問が候補ボタンから消えてしまう
        if (response.errorCode) {
          notifyError(
            response.errorMessage ?? "うまく聞けんかった。もう一度試してみてね。",
            { label: "もう一度", run: () => void askRef.current?.(text, source, withContext) }
          );
          return;
        }

        if (response.shops?.length) {
          setShopsById((prev) => {
            const next = { ...prev };
            for (const shop of response.shops ?? []) next[shop.id] = shop;
            return next;
          });
        }

        const answer = (response.turns ?? [])
          .map((turn) => turn.text)
          .join("\n\n")
          .trim();

        setEntries((prev) => [
          {
            id: response.consultId ?? `${Date.now()}`,
            question: text,
            answer: answer || response.reply,
            speakerName: response.turns?.[0]?.speakerName,
            shopIds: response.shopIds,
            followUpQuestion: response.followUpQuestion,
          },
          ...prev,
        ]);
      } catch {
        notifyError("つながらんかった。電波を確かめて、もう一度試してみてね。", {
          label: "もう一度",
          run: () => void askRef.current?.(text, source, withContext),
        });
      } finally {
        setStreamingText(null);
        setStreamingSpeaker(null);
        setPendingQuestion(null);
        setPhase("idle");
      }
    },
    [notifyError, onAskStream, phase]
  );

  const askRef = useRef<typeof ask | null>(null);
  askRef.current = ask;

  useEffect(() => {
    if (!hasRestored || autoAsked || !autoAskText) return;
    setAutoAsked(true);
    void ask(autoAskText, "input", true);
  }, [ask, autoAsked, autoAskText, hasRestored]);

  const current = entries[0] ?? null;
  const suggestions = useMemo(
    () => pickSuggestions({ entries, pool: QUESTION_POOL }),
    [entries]
  );

  const resolveShops = useCallback(
    (shopIds?: number[]) =>
      (shopIds ?? [])
        .map((id) => shopsById[id] ?? allShops.find((shop) => shop.id === id))
        .filter((shop): shop is Shop => !!shop)
        .slice(0, 6),
    [allShops, shopsById]
  );
  const currentShops = useMemo(
    () => resolveShops(current?.shopIds),
    [current?.shopIds, resolveShops]
  );

  /**
   * 前回の相談を開き直したときは、店舗の実体が手元に無い（ID しか保存していない）。
   * そのままだと写真の出ないカードになるので、取り直す。
   *
   * ただし全件取得は屋外の細い回線には重いので、
   * 「引けない ID が実際にあるとき」だけ、1回に限って取りに行く。
   */
  const shopFetchStartedRef = useRef(false);
  useEffect(() => {
    if (!hasRestored || shopFetchStartedRef.current) return;
    const needed = entries.flatMap((entry) => entry.shopIds ?? []);
    if (needed.length === 0) return;
    const hasMissing = needed.some(
      (id) => !shopsById[id] && !allShops.some((shop) => shop.id === id)
    );
    if (!hasMissing) return;

    shopFetchStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/shops");
        if (!response.ok) return;
        const payload = (await response.json()) as { shops?: Shop[] };
        if (cancelled || !Array.isArray(payload.shops)) return;
        setShopsById((prev) => {
          const next = { ...prev };
          for (const shop of payload.shops ?? []) next[shop.id] = shop;
          return next;
        });
      } catch {
        // 取れなくても写真が出ないだけで、相談自体は続けられる
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allShops, entries, hasRestored, shopsById]);

  const isBusy = phase === "thinking";
  const showAnswer = isBusy || streamingText !== null || !!current;

  const handleMicTap = () => {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    toast.dismiss("consult-error");
    setPhase("idle");
    speech.start();
  };

  const cancelVoice = () => {
    // 印を立ててよいのは、これから onend が来る「聞き取り中」のときだけ。
    // 確認中に立てると、次に成功した音声入力を取り違えて捨ててしまう
    if (speech.isListening) {
      cancellingRef.current = true;
      speech.stop();
    }
    setDraft("");
    setPhase("idle");
  };

  const openTextInput = () => {
    setTextOpen(true);
    setTyped(draft);
    // シートが描画されてからでないとフォーカスが乗らない
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

  return (
    <div
      className="flex min-h-[calc(100dvh-96px)] w-full flex-col gap-3 px-4 pt-3"
      // 下端に固定した「話しかける」とナビゲーションバーの分だけ空ける。
      // ここを決め打ちにすると、ホームインジケータのある端末で本文が隠れる
      style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 6rem)" }}
    >
      {/*
        にちよさんは常に画面に残す。
        話し相手が読み進めるうちに消えてしまうと、話しかける相手が居なくなり、
        音声入力の入口（＝キャラ自身がボタン）にも戻れなくなるため。
        答えが長いときはここだけが残り、本文がこの下を流れていく。
      */}
      {/* 「画面の一番上にいるか」を測るための目印。見た目には出ない */}
      <div ref={topSentinelRef} aria-hidden="true" className="h-px w-full shrink-0" />

      {/*
        固定バー。高さは常に一定で、中身は不透明度と transform でしか動かさない。

        以前はここでキャラの height / width をアニメーションさせていたが、
        それだとスクロール中に毎フレーム レイアウトが走り、下の本文まで動いて
        スクロールと喧嘩する（ガタついて見える原因）。
        大きいにちよさんは下の通常フローに置いて自然に流れさせ、
        ここには小さいにちよさんが出入りするだけにした。
      */}
      <div className="sticky top-0 z-30 -mx-4 flex h-[76px] shrink-0 items-center gap-3 px-4">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-[#FFFAF0]/85 backdrop-blur-md transition-opacity duration-200 ${
            isScrolledDown ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* 下の本文が固定バーの縁でぶつ切りに見えないようにする */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-full h-4 bg-gradient-to-b from-[#FFFAF0]/85 to-transparent transition-opacity duration-200 ${
            isScrolledDown ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* 読み進めている間の話し相手。大きさは変えず、出入りだけさせる */}
        <div
          className={`relative transition-[opacity,transform] duration-200 ${
            isScrolledDown
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0"
          }`}
        >
          <GrandmaAvatar
            pose={pose}
            size="pinned"
            onClick={speech.isSupported ? handleMicTap : undefined}
            label={speech.isListening ? "音声入力を止める" : "にちよさんに話しかける"}
          />
        </div>

        <div className="relative ml-auto">
          {speech.isListening ? (
            // 聞き取り中は、上まで戻らなくても分かるようにする
            <span className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white">
              聞きよるよ…
            </span>
          ) : entries.length > 1 ? (
            // 畳んだ履歴。件数を出しておかないと「消えた」と思われる
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded-full border border-amber-200/80 bg-white/70 px-4 py-1.5 text-xs font-bold text-amber-800"
            >
              これまでの相談 {entries.length}件 ▾
            </button>
          ) : null}
        </div>
      </div>

      {/*
        主役のにちよさん。通常フローに置いてあるので、読み進めれば自然に
        画面外へ流れ、上に戻ればまた現れる。大きさは一切変えないので
        スクロール中にレイアウトが動かない。
      */}
      <div className="flex flex-col items-center gap-2">
        <GrandmaAvatar
          pose={pose}
          size="hero"
          onClick={speech.isSupported ? handleMicTap : undefined}
          label={speech.isListening ? "音声入力を止める" : "にちよさんに話しかける"}
        />
        {(speech.isListening || !showAnswer) && (
          <p className="text-center text-sm font-bold text-amber-900">
            {speech.isListening
              ? "聞きよるよ…"
              : speech.isSupported
                ? "にちよさんをタップして話しかけてね"
                : "聞きたいことを選んでね"}
          </p>
        )}
      </div>

      {/* 今の答え。1枚だけ */}
      {showAnswer && (
        <div className="rounded-3xl border border-amber-100 bg-white/90 p-4 shadow-sm">
          {/* 質問は隠さず、明確に格下で置く。誤認識に気づける必要があるため */}
          <p className="truncate text-xs text-slate-400">
            {pendingQuestion ?? current?.question}
          </p>
          <p className="mt-1 text-[11px] font-bold text-amber-700">
            {streamingSpeaker ?? current?.speakerName ?? "にちよさん"}
          </p>
          {isBusy && !streamingText ? (
            // 応答待ち。前の答えを残すと「過去の会話が透けている」ように見えるので、
            // これから来る文章の骨組みだけを出す
            <div className="mt-3 flex flex-col gap-2" aria-live="polite" aria-label="考え中">
              <span className="consult-skeleton h-3.5 w-4/5 rounded-full" />
              <span className="consult-skeleton h-3.5 w-full rounded-full" style={{ animationDelay: "120ms" }} />
              <span className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "240ms" }} />
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-800">
              {streamingText !== null ? streamingText || "…" : current?.answer}
            </p>
          )}

          {/* 紹介されたお店。写真を主役にしたカードで出す */}
          {!isBusy && currentShops.length > 0 && onSelectShop && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-bold text-amber-700">
                {currentShops.length === 1 ? "このお店だよ" : `おすすめのお店 ${currentShops.length}件`}
              </p>
              {currentShops.length === 1 ? (
                <ConsultShopCard shop={currentShops[0]} onSelect={onSelectShop} variant="single" />
              ) : (
                // 横スワイプにして、答えのカードが縦に伸びないようにする
                <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
                  {currentShops.map((shop) => (
                    <ConsultShopCard key={shop.id} shop={shop} onSelect={onSelectShop} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 候補ボタン。ここが主役。待っている間は薄く残さず、消す */}
      {phase === "idle" && !isBusy && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          {suggestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void ask(question, "suggestion")}
              className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-4 text-left text-base font-bold text-amber-900 shadow-sm transition active:scale-[0.98]"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* 音声は大きく、文字は最後の手段として小さく。
          音声シートが出ている間と応答待ちの間は、押すべきものが2つにならないよう隠す */}
      <div
        className={`fixed inset-x-0 z-20 flex items-center justify-center gap-3 px-4 ${
          speech.isListening || phase !== "idle" || isBusy ? "hidden" : ""
        }`}
        style={{ bottom: "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 0.75rem)" }}
      >
        {/*
          答えが長いとき、本文はこの固定ボタンの下を流れていく。
          何も敷かないと文章が不透明なボタンでぶつ切りにされ、
          読んでいる途中で1行が消えたように見える。
          下に向かって背景色へ溶かし、「続きは下にある」と分かるようにする。
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-10 -z-10 bg-gradient-to-b from-transparent via-[#FFFAF0]/95 to-[#FFFAF0]"
          style={{
            bottom: "calc(-1 * (var(--safe-bottom, 0px) + var(--nav-bar-height) + 0.75rem))",
          }}
        />

        {speech.isSupported && (
          <button
            type="button"
            onClick={handleMicTap}
            disabled={isBusy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-bold shadow-lg transition disabled:opacity-50 ${
              speech.isListening
                ? "bg-red-500 text-white"
                : "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
            }`}
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
            {speech.isListening ? "とめる" : "話しかける"}
          </button>
        )}
        <button
          type="button"
          onClick={openTextInput}
          disabled={isBusy}
          aria-label="文字で聞く"
          className={`flex items-center justify-center rounded-full border border-amber-200 bg-white/95 text-amber-800 shadow-lg disabled:opacity-50 ${
            speech.isSupported ? "h-14 w-14" : "flex-1 gap-2 px-6 py-4 text-base font-bold"
          }`}
        >
          <Keyboard className="h-5 w-5" aria-hidden="true" />
          {!speech.isSupported && "文字で聞く"}
        </button>
      </div>

      {/*
        音声入力のシート。

        画面のどこまでスクロールしていても使えるよう、通常フローではなく
        ビューポートに固定する。以前は「聞こえている内容」も「送信ボタン」も
        通常フローの上のほうに置いていたため、読み進めた状態で話しかけると
        自分が何と言ったのかも、どう送るのかも画面に出てこなかった。

        背後を暗くしているのは、この瞬間にやることを1つに絞るため。
      */}
      {(speech.isListening || phase === "confirming") && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={cancelVoice}
            aria-hidden="true"
          />

          <div
            className="relative rounded-t-3xl bg-white px-4 pt-4 shadow-2xl"
            style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5rem)" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
                {speech.isListening ? (
                  <>
                    <span className="consult-mic-dot h-2.5 w-2.5 rounded-full bg-red-500" />
                    聞きよるよ…
                  </>
                ) : (
                  "これでよかった？"
                )}
              </p>
              <button type="button" onClick={cancelVoice} aria-label="やめる">
                <X className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </button>
            </div>

            {/* 何と言ったのかを、確認できる大きさで出す */}
            <p
              className="min-h-[3.5rem] text-xl leading-relaxed text-slate-800"
              aria-live="polite"
            >
              {speech.isListening ? (
                speech.interim || (
                  <span className="text-slate-400">聞きたいことを話してね</span>
                )
              ) : (
                draft
              )}
            </p>

            {speech.isListening ? (
              <button
                type="button"
                onClick={speech.stop}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-slate-800 px-6 py-4 text-lg font-bold text-white shadow-sm transition active:scale-[0.98]"
              >
                <Square className="h-4 w-4 shrink-0" aria-hidden="true" />
                話し終わった
              </button>
            ) : (
              <>
                {/* 送信は主たる操作なので、幅いっぱい・高さも十分に取る */}
                <button
                  type="button"
                  onClick={() => void ask(draft, "input")}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-4 text-lg font-bold text-white shadow-sm transition active:scale-[0.98]"
                >
                  <Send className="h-5 w-5 shrink-0" aria-hidden="true" />
                  これで聞く
                </button>

                {/* やり直し系は下段に並べ、主たる操作と強さを分ける */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("idle");
                      speech.start();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-amber-200 py-3 text-sm font-bold text-amber-800 transition active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                    言い直す
                  </button>
                  <button
                    type="button"
                    onClick={openTextInput}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-amber-200 py-3 text-sm font-bold text-amber-800 transition active:scale-[0.98]"
                  >
                    <Keyboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                    文字で直す
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 文字入力は最後の手段なので、普段は畳んでおく */}
      {textOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setTextOpen(false)}
            aria-hidden="true"
          />
          <div
            className="relative rounded-t-3xl bg-white p-4"
            style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5rem)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-amber-900">文字で聞く</p>
              <button type="button" onClick={() => setTextOpen(false)} aria-label="閉じる">
                <X className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </button>
            </div>
            <textarea
              ref={textInputRef}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              rows={3}
              placeholder="（例）今の旬の果物は？"
              className="w-full rounded-2xl border border-amber-200 p-3 text-base text-slate-800 outline-none focus:border-amber-400"
            />
            <button
              type="button"
              disabled={!typed.trim()}
              onClick={() => {
                const question = typed.trim();
                setTextOpen(false);
                setTyped("");
                void ask(question, "input");
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-4 text-base font-bold text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              聞く
            </button>
          </div>
        </div>
      )}

      {/*
        過去の相談。消えたのではなく畳まれているだけ、と分かるようにする。

        見出しと「最初からにする」は固定し、一覧だけをスクロールさせる。
        シート全体を1つのスクロール領域にしていたときは、下まで読むと
        閉じるボタンも下のボタンも画面外へ流れ、一番上まで戻らないと
        押せなかった。
      */}
      {historyOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setHistoryOpen(false)}
            aria-hidden="true"
          />

          <div className="relative flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-white">
            <div className="flex shrink-0 items-center justify-between border-b border-amber-100 px-4 py-3">
              <p className="text-sm font-bold text-amber-900">
                これまでの相談（{entries.length}件）
              </p>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="閉じる">
                <X className="h-5 w-5 text-slate-400" aria-hidden="true" />
              </button>
            </div>

            {/* ここだけスクロールする。overscroll-contain で背後まで動かさない */}
            <ul className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
              {entries.map((item) => {
                const itemShops = resolveShops(item.shopIds);
                return (
                  <li key={item.id} className="border-b border-amber-100 pb-3 last:border-0">
                    <p className="text-xs text-slate-400">{item.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {item.answer}
                    </p>
                    {itemShops.length > 0 && onSelectShop && (
                      <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
                        {itemShops.map((shop) => (
                          <ConsultShopCard key={shop.id} shop={shop} onSelect={onSelectShop} />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div
              className="shrink-0 border-t border-amber-100 bg-white px-4 pt-3"
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 5rem)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setEntries(createEmptySession().entries);
                  setHistoryOpen(false);
                }}
                className="w-full rounded-full border border-amber-200 py-3 text-sm font-bold text-amber-800 transition active:scale-[0.98]"
              >
                相談を最初からにする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
