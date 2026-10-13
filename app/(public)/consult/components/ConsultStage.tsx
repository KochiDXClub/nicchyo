"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  AlertCircle,
  Keyboard,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Send,
  Square,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSpeechInput } from "@/lib/hooks/useSpeechInput";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import { buildConsultGreeting } from "@/lib/grandma/consultGreeting";
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
import ConsultCharacterSwap from "./ConsultCharacterSwap";
import { ConsultFeedback } from "@/components/consult/ConsultFeedback";
import { Badge, Button } from "@/components/ui";
import {
  CONSULT_CHARACTERS,
  CONSULT_CHARACTER_BY_ID,
  DEFAULT_CONSULT_CHARACTER,
  type ConsultCharacter,
  type ConsultCharacterId,
} from "../data/consultCharacters";
import ConsultShopCard from "./ConsultShopCard";
import ConsultSheet from "./ConsultSheet";
import { isImeComposing } from "@/lib/utils/isImeComposing";
import { useDialogFocus } from "@/lib/ui/useDialogFocus";
import type { Shop } from "../../map/data/shops";
import type {
  ConsultAskResponse,
  ConsultAskStreamEvent,
  ConsultHistoryEntry,
} from "../types/consultConversation";

const SESSION_STORAGE_KEY = "nicchyo-consult-session";
/**
 * マップ上の相談から「くわしく相談する」で渡ってきた引き継ぎ。
 * 書き手の MapCharacterConsult は廃止したので新しくは書かれない。
 * 以前の版で書かれて端末に残っている分を、読んで消すためだけに残している
 */
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

/** 開いたとき、話し手がその場に現れきるまで。出そろってから本文を出す */
const APPEAR_MS = 420;

/**
 * 下端に固定した「話しかける」バーとナビゲーションバーぶんの余白。
 *
 * スクロール領域の height（-var(--consult-bar-space) で削る側）と、
 * その下の paddingBottom（本文が隠れないようにする側）の両方で同じ値を
 * 使う必要がある。別々にハードコードすると、どちらか一方だけ変更したときに
 * 本 PR で直した「候補ボタンと入力バーの重なり」が再発するため、
 * ここ1箇所だけで定義し、CSS カスタムプロパティ経由で両方から参照する。
 *
 * 5rem の内訳: バーの下の隙間 0.75rem + バーの高さ 3.5rem（h-14）+ バーの上の隙間 0.75rem。
 * 以前は 6rem で、バーとの間に何も描かれない帯が 1.75rem あり、そのぶん本文の
 * 見える高さが削られていた（候補ボタンが見切れやすかった）。境目の上下には
 * 下端のぼかしが掛かるので、隙間はこれで足りる
 */
const CONSULT_BAR_SPACE = "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 5rem)";

/**
 * lg 以上（PC・ノートPC）用。候補ボタンを入力欄のすぐ上まで下げたいので、
 * スマホ用より 0.75rem 少なく取る（入力欄の上端はナビの 4.4rem 上にあるので、
 * 5.25rem なら入力欄との間に約 0.85rem 残る）。
 * 入力バーの高さ・位置を変えるときは CONSULT_BAR_SPACE と一緒に見直すこと
 */
const CONSULT_BAR_SPACE_LG = "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 5.25rem)";

/**
 * 「これまでの相談」サイドバーがチャット欄の横に並ぶ幅（Tailwind の lg と同じ）。
 * これより狭い画面では、サイドバーはチャット欄の上に重なる引き出しになる
 */
const HISTORY_SIDEBAR_INLINE_MEDIA = "(min-width: 1024px)";

/**
 * 「これまでの相談」サイドバーを開け閉めするときの動き（左からすっと出て、左へ戻る）。
 * PC では、横へずれるチャット欄・入力バー（CSS の transition。`duration-300` と
 * `ease-out-soft`）とこの値を揃え、サイドバーが本文を押しのけていくように見せる。
 * 緩急は tailwind.config の ease-out-soft と同じ
 */
const HISTORY_SIDEBAR_SLIDE_SECONDS = 0.3;
const HISTORY_SIDEBAR_SLIDE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
  /** いま話しているキャラ。null なら既定のにちよさん */
  preferredCharacterId?: ConsultCharacterId | null;
  onPreferredCharacterChange?: (id: ConsultCharacterId) => void;
  /**
   * 「これまでの相談」サイドバーの開閉状態。
   * チャット欄を中央に置くか右へ逃がすか（lg 以上）は親（ConsultClient）側の
   * レイアウトが決めるため、開閉の状態そのものは親に持たせ、ここからは通知だけする。
   */
  isHistorySidebarOpen?: boolean;
  onHistorySidebarOpenChange?: (open: boolean) => void;
}

type StagePhase = "idle" | "confirming" | "thinking";

/**
 * lg 未満で「これまでの相談」を引き出しとして開いている間だけ描く。
 * フックは条件付きで呼べないので、開いている間だけ存在する子に持たせる
 * （開いたら中へフォーカスを移し、Tab を中で回し、閉じたら開くボタンへ戻す）
 */
function HistoryDrawerFocus({
  panelRef,
  returnFocusRef,
}: {
  panelRef: RefObject<HTMLElement | null>;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  useDialogFocus(panelRef, undefined, { returnFocusRef });
  return null;
}

/**
 * 現地・スマホ・片手を前提にした相談画面。
 *
 * 会話ログを積み上げず、「今の答え」1枚だけを主役にする。
 * 現地の相談はほぼ全部が独立した1往復で終わり、文脈が積み上がらないため、
 * ログを積むと縦に伸びるだけで得がない（キャラを大きく置く余地も失う）。
 *
 * 入力手段は、候補ボタン・文字入力を既定にし、音声は選べる小さいボタンに
 * している（静かな場所や周りに人がいるときは声を出しにくいため）。
 */
export default function ConsultStage({
  onAskStream,
  allShops = [],
  onSelectShop,
  autoAskText,
  autoAskContext,
  preferredCharacterId,
  onPreferredCharacterChange,
  isHistorySidebarOpen = false,
  onHistorySidebarOpenChange,
}: ConsultStageProps) {
  const [entries, setEntries] = useState<ConsultEntry[]>([]);
  const [phase, setPhase] = useState<StagePhase>("idle");
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [streamingSpeaker, setStreamingSpeaker] = useState<string | null>(null);
  /** 応答待ちの間も「何を聞いたか」を出しておくため */
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [hasRestored, setHasRestored] = useState(false);
  const [autoAsked, setAutoAsked] = useState(false);
  /**
   * 今の答えのカードを出してよいか。
   *
   * 開き直したときに前の答えが出ていると、聞いてもいないのに誰かが喋っている
   * 画面になり、話しかける前から読むものが積まれる。相談は1往復で終わることが
   * ほとんどなので、開いたときはまっさらにして、前の相談は「これまでの相談」に畳む。
   * （畳むだけで消しはしない）
   */
  const [showsCurrentAnswer, setShowsCurrentAnswer] = useState(false);
  /**
   * 「これまでの相談」の1件をタップして、大きい答えカードとして開き直したときの
   * 対象。null のときは既定どおり最新（entries[0]）を出す。新しく質問したときは
   * また最新を見せたいので、ask() の頭で null に戻す
   */
  const [viewedEntryId, setViewedEntryId] = useState<string | null>(null);
  /**
   * 回答に添えられて返ってきたお店。
   * 店舗そのものは localStorage に保存せず（重いので）ID だけ持ち、
   * 実体はこの表と allShops から引く。
   */
  const [shopsById, setShopsById] = useState<Record<number, Shop>>({});

  const entriesRef = useRef<ConsultEntry[]>([]);
  entriesRef.current = entries;
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  /** 「これまでの相談」から答えカードを開き直したとき、その場所までスクロールを戻す */
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  /** 「さっきの答えをもう一度見る」で開いたとき、フォーカスを移す先 */
  const answerCardRef = useRef<HTMLDivElement | null>(null);
  /**
   * 読み上げ用の知らせ（「考えよるよ」「答えが出たよ」）。
   * 骨組みや答えの本文は、出てくるのと同時に差し込まれるので読み上げられない。
   * 常に置いてある1つの要素の中身だけを変えて、状態が変わったことを伝える
   */
  const [statusMessage, setStatusMessage] = useState("");
  /** 話し手の立ち位置。入れ替わりの歩きはここへ着く */
  const heroAvatarRef = useRef<HTMLDivElement | null>(null);
  /**
   * 話し手が現れきったか。
   * 出そろってから本文（ひとこと・候補ボタン・下のボタン）をじわっと出す。
   * 同時に出すと、画面がいきなり埋まって唐突に見えるため。
   */
  const [introSettled, setIntroSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIntroSettled(true), APPEAR_MS);
    return () => clearTimeout(timer);
  }, []);
  /** 出てくる順を少しずらす。段になって流れると急に埋まった感じが消える */
  const revealClass = (delayMs: number) => ({
    className: `consult-reveal${introSettled ? " is-shown" : ""}`,
    style: { animationDelay: `${delayMs}ms` },
  });

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

  /**
   * 本文の一番下が見えているか。見えている間は、下端のぼかしを出さない
   * （出すと、続きが無いのに最後の候補ボタンまで薄くなり、かえって見切れて見える）。
   * 上の目印と同じく、スクロール量は毎フレーム見ずに IntersectionObserver で見る。
   * 少しでも隠れていれば出す（隠れているのにぼかしが無いと、ボタンの縁が真横に
   * 切れて見える）
   */
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const [isContentEndVisible, setIsContentEndVisible] = useState(true);
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsContentEndVisible(entry.isIntersecting),
      { root, threshold: 0 }
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

  // 今の話し手。選んでいなければ既定のにちよさんが出る
  const speaker =
    (preferredCharacterId ? CONSULT_CHARACTER_BY_ID.get(preferredCharacterId) : null) ??
    DEFAULT_CONSULT_CHARACTER;
  const [isSpeakerPickerOpen, setIsSpeakerPickerOpen] = useState(false);

  /**
   * 今の話し手が言う、最初のひとこと。
   *
   * 台本は人ごとに持たせてある（口調が違う人に同じ挨拶をさせると、
   * 選び分ける意味がなくなる）。選ばれるたびにその人の台本を1つ進めるので、
   * 行ったり来たりしても同じ台詞が続かない。
   *
   * 引く位置に乱数を使うのは初回だけ。描画のたびに変えるとサーバーと食い違うので、
   * mount 後の effect で決める。
   */
  const greetingIndexRef = useRef<Record<string, number>>({});
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    const shown = greetingIndexRef.current[speaker.id];
    const index =
      shown === undefined
        ? Math.floor(Math.random() * speaker.greeting.lines.length)
        : shown + 1;
    greetingIndexRef.current[speaker.id] = index;
    setGreeting(buildConsultGreeting({ now: new Date(), script: speaker.greeting, index }));
  }, [speaker]);

  /**
   * 話し手の入れ替わり。
   *
   * 前の人が右へ歩いて去り、新しい人が左から歩いてくる。絵が差し替わるだけだと
   * 「今だれと話しているのか」が変わったことに気づけないため。
   * 歩いているあいだページ側の絵は隠す（同じ人が2人並んで見えないように）。
   */
  const [swapFrom, setSwapFrom] = useState<ConsultCharacter | null>(null);
  const shownSpeakerRef = useRef(speaker);
  /**
   * この画面で利用者が選び直したか。
   *
   * 前に選んだ話し手は localStorage から読み直しており、それが効くのは
   * 一度描いたあとになる。つまり開いた直後に「にちよさん → 選んでいた人」と
   * いう変化が必ず起きる。これを入れ替わりとして歩かせると、
   * 他のページから戻ってくるたびに交代の演出が流れてしまう。
   * 歩かせてよいのは、この画面で押して選んだときだけ。
   */
  const pickedByUserRef = useRef(false);
  useEffect(() => {
    if (shownSpeakerRef.current.id === speaker.id) return;
    const previous = shownSpeakerRef.current;
    shownSpeakerRef.current = speaker;
    if (!pickedByUserRef.current) return;
    setSwapFrom(previous);
  }, [speaker]);
  const handleSwapDone = useCallback(() => setSwapFrom(null), []);
  const handlePickSpeaker = useCallback(
    (id: ConsultCharacterId) => {
      pickedByUserRef.current = true;
      onPreferredCharacterChange?.(id);
      setIsSpeakerPickerOpen(false);
    },
    [onPreferredCharacterChange]
  );

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
      if (handed.length > 0) {
        window.localStorage.removeItem(HANDOFF_STORAGE_KEY);
        // マップの相談から「くわしく相談する」で渡ってきたぶんは、その続きを
        // 話しに来ているので出す
        setShowsCurrentAnswer(true);
      }
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
            // 自前の知らせ（toast.custom）には react-hot-toast が読み上げ用の役割を
            // 付けないので、ここで付ける
            role="alert"
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

      // 失敗したときは、打った（または話した）質問を入力欄に戻す。送る前に入力欄を
      // 空にしているので、戻さないと知らせを閉じた時点で質問ごと消え、屋外で
      // 打ち直すことになる。候補ボタンはまた押せるので戻さない。
      // QR やリンク（?q=&shopId=）から自動で聞いた分も戻さない。入力欄から送り直すと
      // 店の前提が付かないので、前提ごと聞き直せる知らせの「もう一度」に任せる
      const restoresTyped = source === "input" && !withContext;
      const restoreTyped = () => {
        if (restoresTyped) setTyped((current) => current || text);
      };
      // 知らせの「もう一度」で聞き直すときは、戻しておいた質問を入力欄から消す
      if (restoresTyped) setTyped((current) => (current.trim() === text ? "" : current));
      toast.dismiss("consult-error");
      // 過去の相談を開き直していても、新しく聞いたらまた最新の答えを見せる
      setViewedEntryId(null);
      setPhase("thinking");
      setDraft("");
      setPendingQuestion(text);
      setStreamingText(null);
      setStreamingSpeaker(null);
      setStatusMessage("考えよるよ…");

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
          restoreTyped();
          // 失敗は知らせ（role="alert"）が読み上げるので、こちらは空にする
          setStatusMessage("");
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

        // 答えが返ってきてから出す。ここより前で立てると、聞くのに失敗したときに
        // 「前に畳んだはずの答え」が代わりに出てきてしまう
        setShowsCurrentAnswer(true);
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
        setStatusMessage("答えが出たよ");
      } catch {
        restoreTyped();
        setStatusMessage("");
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

  // 既定は最新（entries[0]）。「これまでの相談」から1件タップして開き直しているときは
  // viewedEntryId が指す、その場所を優先する
  const current = showsCurrentAnswer
    ? (viewedEntryId ? entries.find((entry) => entry.id === viewedEntryId) : undefined) ??
      entries[0] ??
      null
    : null;

  /**
   * いまの画面幅で、「これまでの相談」サイドバーがチャット欄の横に並ぶか（lg 以上）。
   * 並ばない幅では引き出しとしてチャット欄の上に重なるので、モーダルとして扱う
   * （フォーカスを中に閉じ込め、Esc で閉じ、1件開いたら閉じる）
   */
  const [isHistorySidebarInline, setIsHistorySidebarInline] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(HISTORY_SIDEBAR_INLINE_MEDIA);
    const sync = () => setIsHistorySidebarInline(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const isHistoryDrawer = isHistorySidebarOpen && !isHistorySidebarInline;
  // 動きを減らす設定の端末では、サイドバーも暗幕もその場で出し入れする
  const prefersReducedMotion = useReducedMotion();
  const historySlideTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: HISTORY_SIDEBAR_SLIDE_SECONDS, ease: HISTORY_SIDEBAR_SLIDE_EASE };
  const historyPanelRef = useRef<HTMLDivElement | null>(null);
  /** 引き出しを閉じたとき、フォーカスを戻す先 */
  const openHistoryButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!isHistoryDrawer) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onHistorySidebarOpenChange?.(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHistoryDrawer, onHistorySidebarOpenChange]);

  // 「これまでの相談」の1件をタップして、大きい答えカードとして開き直す
  const viewHistoryEntry = useCallback(
    (id: string) => {
      setViewedEntryId(id);
      setShowsCurrentAnswer(true);
      // lg 未満のサイドバーは答えカードの上に重なってしまうので閉じる。
      // lg 以上はチャット欄を右へ逃がして隠さないので、開いたままでもよい
      if (!isHistorySidebarInline) onHistorySidebarOpenChange?.(false);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [isHistorySidebarInline, onHistorySidebarOpenChange]
  );
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

  /**
   * 「これまでの相談」サイドバーの中身。PC もモバイルも同じ一覧を使う。
   * Claude デスクトップ版の会話一覧のように、1行がコンパクトな行として並ぶ
   * （答えは2行に丸め、店は出さない）。タップすると、その相談を大きい答えカード
   * （おばあちゃんの今の返事として表示される場所）に開き直す。紹介した店や
   * 評価ボタンは、開き直した先の答えカードに出る。
   *
   * 今カードに出ている分（current）も一覧から外さず、選んでいる行として
   * 強調表示するだけにする。以前は current を一覧から外していたが、
   * 「これまでの相談」が1件しかないときにそれをタップすると、外を持たない
   * 一覧が0件になってサイドバーごと消えてしまい、「展開したのに展開先が消える」
   * というおかしな体験になっていた（Claudeデスクトップ版でも、開いている
   * 会話は一覧から消えず選択中として残る）。
   */
  const renderHistoryList = () => (
    <ul className="flex flex-col gap-0.5">
      {entries.map((item) => {
        const isActive = item.id === current?.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => viewHistoryEntry(item.id)}
              aria-current={isActive}
              className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                isActive ? "bg-amber-100" : "hover:bg-amber-50"
              }`}
            >
              <p className="line-clamp-1 text-sm font-bold text-slate-800">{item.question}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
                {item.answer}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );

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

  // 音声の確認シートから「文字で直す」に切り替えるときだけ使う。
  // 入力欄自体は最初から常に出ているので、ここでは
  // シートを閉じて聞き取れた分を引き継ぎ、フォーカスを移すだけでよい
  const openTextInput = () => {
    setPhase("idle");
    setTyped(draft);
    setDraft("");
    requestAnimationFrame(() => textInputRef.current?.focus());
  };

  return (
    <div
      ref={scrollContainerRef}
      // min-height ではなく height + overflow-y-auto にして、この中だけで
      // スクロールを完結させる。min-height のままページ全体でスクロールさせると、
      // 下端固定の「話しかける」バーはビューポート基準の位置に居続けるのに対し、
      // キャラ・ひとこと・候補ボタンは開いた直後（スクロール前）の自然な高さで
      // 描かれるため、縦の低い画面（PCの非全画面ウィンドウなど）では
      // スクロールする前から候補ボタンにバーが重なって見えていた。
      //
      // height は「下端の話しかけるバーの分（--consult-bar-space、paddingBottom
      // と同じ値）」を引く。paddingBottom だけでは、中身がその場に収まってしまう
      // 高さのときスクロールが発生せず、バーの領域まで普通に描画されて
      // 隠れてしまうため、「バーの領域には最初から描画させない」ところまで
      // height 側でも絞る。
      //
      // 親 main 側には上の余白を一切持たせない。上の余白は、この要素の
      // padding-top ではなく最初の子（topSentinelRef）の margin-top で作る。
      // スクロールコンテナ自身に padding-top を付けると、sticky な子要素は
      // その padding ぶんより内側（画面最上部寄り）には張り付けなくなる
      // （sticky の張り付き基準がスクロールポートの padding edge になるため）。
      // その結果、どれだけスクロールしても画面最上部に padding-top ぶんの
      // 隙間が残り続けてしまう。margin なら sticky の基準に含まれないため、
      // スクロールすれば margin ごと上に流れ、固定バーが画面最上部にぴったり張り付く。
      //
      // 幅は絞らず w-full のまま（PC で読みやすい行幅に絞るのは内側のラッパーで
      // 行う）。ここで max-w を付けてしまうと、スクロールする箱自体が狭くなり、
      // 縦スクロールバーが画面の右端ではなく箱の右端＝中途半端な位置に出てしまう
      // scroll-pb-10: Tab で下端の候補ボタンへ移ったとき、下端のぼかしに隠れない所まで送る
      className="h-[calc(100dvh-var(--consult-bar-space)-var(--consult-top-space,0px))] w-full scroll-pb-10 overflow-y-auto px-4 pb-4 lg:h-[calc(100dvh-var(--consult-bar-space-lg))] lg:pb-0"
      style={
        {
          // 下端に固定した「話しかける」とナビゲーションバーの分は、上の
          // height 側で既に差し引いている（この箱自体がその高さぶん
          // 画面の下までは伸びない）。ここでさらに paddingBottom を
          // CONSULT_BAR_SPACE と同じ値にすると二重に空いてしまうので、
          // 最後の要素がバーに張り付かない程度の小さい余白（className の pb-4）
          // だけ持たせる。lg 以上は候補ボタンを入力欄のすぐ上へ寄せたいので 0 にする
          "--consult-bar-space": CONSULT_BAR_SPACE,
          "--consult-bar-space-lg": CONSULT_BAR_SPACE_LG,
        } as CSSProperties
      }
    >
      {/*
        これまでの相談（サイドバー）。Claude デスクトップ版を参考に、
        ウィンドウ左端に張り付く帯にした。閉じているときは左上に開くアイコンだけを
        浮かせ、開くとその場でサイドバーの見出しに変わる（Claude の開閉と同じ運び）。
        既定は閉じておき、チャット欄は中央のまま保つ。

        PC もモバイルも同じサイドバーを使う（以前のモバイルは下から出るシートで、
        PC と見た目も操作も違っていた）。違うのは開いたときの置き方だけ:
        - lg 以上: チャット欄を右へ逃がして横に並べる（ConsultClient 側の padding-left で処理）
        - lg 未満: 横に並べる幅が無いので、チャット欄の上に重ねる引き出し（モーダル）にする。
          暗幕を敷き、外側のタップか Esc で閉じる。フォーカスは中に閉じ込める

        画面では左上にあるものなので、Tab や読み上げでも最初に来るよう、
        position: fixed のまま DOM の先頭に置く。

        履歴が0件でもサイドバー自体は出しておく（Claude デスクトップ版も会話が
        無い状態で一覧欄を消さない）。ここでいきなり消えると「開いたのに開き先が
        消えた」という体験になるうえ、そもそもサイドバーの存在に気づけない。
        中身が空のときは一覧の代わりに案内文を出す
      */}
      <button
        ref={openHistoryButtonRef}
        type="button"
        onClick={() => onHistorySidebarOpenChange?.(true)}
        aria-label={
          entries.length > 0
            ? `これまでの相談を開く（${entries.length}件）`
            : "これまでの相談を開く"
        }
        aria-expanded={isHistorySidebarOpen}
        // 開いている間も外さずに隠すだけにする。外すと、閉じたときにフォーカスを戻す先が無くなる。
        // lg 未満は指で押せる 44px にし、クリーム色の背景に埋もれないよう面と縁を付ける。
        // lg 以上はこれまで通り面を持たない Claude 風のアイコンにする。
        // 同じ z-30 の固定バーより DOM が前にあるので、z-40 にして固定バーの上に出す
        // lg 未満は上端に「マップにもどる」の帯（--consult-top-space）が出るので、その下に置く
        className={`fixed left-4 top-[calc(var(--safe-top,0px)+var(--consult-top-space,0px)+0.75rem)] z-40 flex h-11 w-11 items-center justify-center rounded-lg border border-amber-200 bg-white/80 text-slate-500 shadow-sm transition hover:bg-black/5 lg:top-[calc(var(--safe-top,0px)+1rem)] lg:h-9 lg:w-9 lg:border-0 lg:bg-transparent lg:shadow-none ${
          isHistorySidebarOpen ? "invisible" : ""
        }`}
      >
        <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
        {/*
          以前のモバイルの「これまでの相談 N件 ▾」が担っていた、件数の見える化。
          アイコンだけだと履歴が0件でも3件でも同じに見え、前の答えが「消えた」と
          思われる。件数は aria-label で読み上げるので、札は飾りにする
        */}
        {entries.length > 0 && (
          <Badge
            variant="amber"
            aria-hidden="true"
            className="absolute -right-2 -top-2 px-1.5"
          >
            {entries.length}
          </Badge>
        )}
      </button>
      {/*
        開け閉めは、いきなり出し入れせずに動かす（PC・モバイル共通）。
        サイドバーは左からすっと出て左へ戻り、モバイルの暗幕はふわっと濃くなる。
        閉じる動きの間も描いておくため、AnimatePresence で外すのを待たせる
      */}
      <AnimatePresence>
        {isHistorySidebarOpen && (
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={historySlideTransition}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => onHistorySidebarOpenChange?.(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
      {isHistorySidebarOpen && (
        <motion.div
          key="history-panel"
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={historySlideTransition}
          ref={historyPanelRef}
          // lg 以上は常設の帯（補足の領域）、lg 未満は背面を覆うモーダル
          role={isHistoryDrawer ? "dialog" : "complementary"}
          aria-modal={isHistoryDrawer || undefined}
          aria-label="これまでの相談"
          // lg 未満は暗幕（z-40）の上、話しかけるバー・固定バーより手前に出す。
          // lg 以上は横に並ぶだけなので、これまで通り音声シートなどより奥に置く
          className="fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-amber-100 bg-white lg:z-20"
          style={{
            // lg 未満は上端の「マップにもどる」の帯（z-[9997]）が手前に出るので、
            // 見出しの閉じるボタンが隠れないよう、帯の分だけ下げる（lg 以上は 0）
            paddingTop: "calc(var(--safe-top, 0px) + var(--consult-top-space, 0px))",
            paddingBottom: "calc(var(--safe-bottom, 0px) + var(--nav-bar-height))",
          }}
        >
          {isHistoryDrawer && (
            <HistoryDrawerFocus panelRef={historyPanelRef} returnFocusRef={openHistoryButtonRef} />
          )}
          <div className="flex shrink-0 items-center gap-2 px-3 py-3">
            <button
              type="button"
              onClick={() => onHistorySidebarOpenChange?.(false)}
              aria-label="これまでの相談を閉じる"
              aria-expanded={true}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-black/5 lg:h-9 lg:w-9"
            >
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="truncate text-sm font-bold text-slate-700">
              これまでの相談{entries.length > 0 ? `（${entries.length}件）` : ""}
            </p>
          </div>
          {/*
            一覧が長いとここ自体がスクロールする。スクロールバーは要素の
            border-box の右端にぴったり付く（padding では動かせない）ため、
            mr-1 でこの箱自体をサイドバーと本文の境界線（border-r）から
            少し離しておかないと、スクロールバーが境界線と重なって見えてしまう
          */}
          <div className="mr-1 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
            {entries.length > 0 ? (
              renderHistoryList()
            ) : (
              <p className="px-2 pt-3 text-sm leading-6 text-slate-400">
                ここに相談の履歴を残していくよ。{speaker.name}に話しかけてみてね
              </p>
            )}
          </div>
          {entries.length > 0 && (
            <div className="shrink-0 border-t border-amber-100 px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("これまでの相談をすべて消すよ。よろしい？")) return;
                  setEntries(createEmptySession().entries);
                }}
                className="w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-amber-800 transition hover:bg-amber-50 lg:py-2"
              >
                相談を最初からにする
              </button>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/*
        読みやすい行幅への制限（max-w-3xl）と、中央寄せ／左寄せの切り替えは
        ここで行う。サイドバーを開いている間は、チャット欄をサイドバーのすぐ右に
        寄せたいので mx-auto をやめて左詰めにする（付けたままだと「サイドバー分を
        除いた幅の中でさらに中央寄せ」になり、サイドバーとの間に空白ができてしまう
        ——ConsultClient の <main> で一度直したのと同じ理由）。閉じている間は
        これまで通り画面全体の中央に置く。

        lg 以上の中央寄せは mx-auto ではなく margin-left の計算値で持つ。auto と 0 の
        切り替えは動かせない（一瞬で飛ぶ）が、計算値と 0 の間なら transition で
        滑らかに動かせるので、サイドバーの開け閉めに合わせて本文をずらせる。

        計算は画面幅（100vw）を基準にする。% を基準にすると、同時に動く <main> の
        padding-left で % の元の幅まで動きの途中で変わり、閉じる終わりぎわに本文が
        数 px 行き過ぎて戻る揺れが出る。100vw なら左端の位置が padding と margin の
        足し算で真っすぐ動く。下の入力バーも同じ式なので、本文と入力欄の左端が揃う。
        lg 以上（1024px〜）では計算値が負になることはない
      */}
      <div
        className={`mx-auto flex w-full max-w-3xl flex-col gap-3 motion-safe:transition-[margin-left] motion-safe:duration-300 motion-safe:ease-out-soft lg:grid lg:max-w-6xl lg:grid-cols-[30%_minmax(0,1fr)] lg:items-start lg:gap-x-8 ${
          isHistorySidebarOpen ? "lg:ml-0" : "lg:ml-[max(0px,calc((100vw_-_2rem_-_72rem)/2))]"
        }`}
      >
      {/*
        にちよさんは常に画面に残す。
        話し相手が読み進めるうちに消えてしまうと、話しかける相手が居なくなり、
        音声入力の入口（＝キャラ自身がボタン）にも戻れなくなるため。
        答えが長いときはここだけが残り、本文がこの下を流れていく。
      */}
      {/*
        「画面の一番上にいるか」を測るための目印。見た目には出ないが、
        上の余白（本来 padding-top で持たせたい分）を margin-top として
        ここに持たせている（理由はスクロールコンテナの className 側のコメント参照）
      */}
      <div
        ref={topSentinelRef}
        aria-hidden="true"
        className="mt-3 h-px w-full shrink-0 lg:col-span-2"
      />

      {/* 話し手の入れ替わり。前の人が右へ去り、新しい人が左から歩いてくる */}
      {swapFrom && (
        <ConsultCharacterSwap
          from={swapFrom}
          to={speaker}
          targetRef={heroAvatarRef}
          onDone={handleSwapDone}
        />
      )}

      {/*
        固定バー。高さは常に一定で、中身は不透明度と transform でしか動かさない。

        以前はここでキャラの height / width をアニメーションさせていたが、
        それだとスクロール中に毎フレーム レイアウトが走り、下の本文まで動いて
        スクロールと喧嘩する（ガタついて見える原因）。
        大きいにちよさんは下の通常フローに置いて自然に流れさせ、
        ここには小さいにちよさんが出入りするだけにした。

        -mb-[76px] で、このバーの高さぶんを後ろの要素に譲る（流れの上では高さ0）。
        一番上にいる間はバーが透明で中身も無いのに、76px の空白として
        大きいにちよさん・候補ボタンを押し下げていたため、縦の短いスマホで
        候補ボタンが下の入力欄に見切れていた。重なっている間は下の大きい
        にちよさん（タップで話し手を選べる）を押せるよう、当たり判定を持たせない。

        左の pl-[4.5rem] は、画面左上に固定した「これまでの相談」を開くボタン
        （left-4 / 幅 w-11）に、小さいにちよさんが重ならないようにする分。
        lg 以上はチャット欄が中央に寄る（サイドバーを開くとボタン自体が消える）ので要らない
      */}
      <div
        className={`sticky top-0 z-30 -mx-4 -mb-[76px] flex h-[76px] shrink-0 items-center gap-3 pl-[4.5rem] pr-4 lg:hidden ${
          isScrolledDown ? "" : "pointer-events-none"
        }`}
      >
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
            character={speaker}
            onClick={() => setIsSpeakerPickerOpen(true)}
            label={`話し手を選ぶ（いまは${speaker.name}）`}
          />
        </div>

        <div className="relative ml-auto">
          {speech.isListening && (
            // 聞き取り中は、上まで戻らなくても分かるようにする
            <span className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white">
              聞きよるよ…
            </span>
          )}
        </div>
      </div>

      {/*
        主役のにちよさん。通常フローに置いてあるので、読み進めれば自然に
        画面外へ流れ、上に戻ればまた現れる。大きさは一切変えないので
        スクロール中にレイアウトが動かない。
      */}
      {/*
        lg 以上（PC・ノートPC）では左30%のカラムに置き、本文を読み進めても
        画面に残り続けるよう sticky にする。スマホでは従来どおり通常フロー。
      */}
      {/*
        高さを「スクロール領域いっぱい」にして中身を縦中央に置く（sticky なので
        本文を読み進めても同じ位置に残る）。高さは lg 用の --consult-bar-space-lg から、
        上の目印の余白（0.75rem + 1px）と行の間隔（0.75rem）ぶんの 1.65rem を引いた値。
        これを引かないと、わずかにスクロールが発生する（lg は下の余白 pb を 0 にしてある）
      */}
      <div className="flex flex-col items-center gap-2 lg:sticky lg:top-0 lg:col-start-1 lg:row-start-2 lg:h-[calc(100dvh-var(--consult-bar-space-lg)-1.65rem)] lg:justify-center">
        {/*
          flex にして、囲んだだけで下に行間の隙間が出ないようにする（測る先がずれる）。
          開いたときはその場に現れ、現れきったら一度だけ会釈する。
          入れ替わりの歩きが走っている間は、こちらを隠して歩く絵に任せる。
        */}
        <div
          ref={heroAvatarRef}
          className={`flex consult-appear${introSettled ? " consult-greet" : ""}`}
          style={{ opacity: swapFrom ? 0 : 1 }}
        >
          <GrandmaAvatar
            pose={pose}
            size="hero"
            character={speaker}
            onClick={() => setIsSpeakerPickerOpen(true)}
            label={`話し手を選ぶ（いまは${speaker.name}）`}
          />
        </div>
        {speech.isListening ? (
          <p className="text-center text-sm font-bold text-amber-900">聞きよるよ…</p>
        ) : (
          !showAnswer &&
          !swapFrom && (
            /*
              最初のひとこと。説明文をそのまま置くのではなく、話し手の言葉として出す。
              「話しかけてよい相手が、もう話しかけてきている」ほうが、
              この画面が何をする場所かが一行の説明よりも早く伝わる。
            */
            <div
              style={revealClass(0).style}
              className={`consult-greeting max-w-[19rem] rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-center shadow-sm ${revealClass(0).className}`}
            >
              <p className="text-[15px] font-bold leading-6 text-amber-900">
                {greeting ?? "なんでも聞いてや。"}
              </p>
              {/*
                前に相談したことがある人には、使い方の案内の代わりに「さっきの答え」へ
                戻る入口を出す。開き直したときは前の答えを畳んでおり（地図や店のページから
                戻ってきたときも同じ）、戻る手段が左上のアイコンだけだと気づかれにくい。
                使い方はもう知っている人なので、案内と入れ替えて画面の高さは増やさない
              */}
              {entries.length > 0 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    viewHistoryEntry(entries[0].id);
                    // 押すとこのボタンごと吹き出しが消え、フォーカスの行き先が無くなる。
                    // 開いた答えのカードへ移して、読み上げや Tab の続きをそこから始める
                    requestAnimationFrame(() =>
                      answerCardRef.current?.focus({ preventScroll: true })
                    );
                  }}
                  className="mt-1.5"
                >
                  さっきの答えをもう一度見る
                </Button>
              ) : (
                // 屋外の日差しの下でも読めるよう、11px・薄い色をやめて 12px・濃い色にする
                <p className="mt-0.5 text-xs text-amber-700">
                  {speech.isSupported
                    ? "下のボタンで話しかけてね。イラストをタップすると話し手を変えられるよ"
                    : "聞きたいことを選んでね。イラストをタップすると話し手を変えられるよ"}
                </p>
              )}
            </div>
          )
        )}
      </div>

      {/*
        答えと候補ボタンは右の70%カラムにまとめる。
        スマホでは display: contents で枠を消し、従来どおり縦並びの子として扱う
        （見た目・間隔は変わらない）。
        lg の上の余白（pt）は、右上に浮かぶ「マップにもどる」バーの下から答えを始めるため
      */}
      <div className="contents lg:col-start-2 lg:row-start-2 lg:flex lg:min-h-[calc(100dvh-var(--consult-bar-space-lg)-1.65rem)] lg:min-w-0 lg:flex-col lg:gap-4 lg:pt-[3.75rem]">
      {/* 今の答え。1枚だけ */}
      {showAnswer && (
        <div
          ref={answerCardRef}
          tabIndex={-1}
          style={revealClass(0).style}
          className={`rounded-3xl border border-amber-100 bg-white/90 p-4 shadow-sm outline-none ${revealClass(0).className}`}
        >
          {/*
            質問は隠さず、明確に格下で置く。誤認識に気づける必要があるため。
            1行で切ると長い質問の後半（聞き間違いが出やすい所）が見えず、薄い色
            （slate-400、白地で約2.6:1）では屋外で読めないので、2行まで出して濃くする
          */}
          <p className="line-clamp-2 text-xs text-nicchyo-ink/70">
            {pendingQuestion ?? current?.question}
          </p>
          <p className="mt-1 text-[11px] font-bold text-amber-700">
            {streamingSpeaker ?? current?.speakerName ?? speaker.name}
          </p>
          {isBusy && !streamingText ? (
            // 応答待ち。前の答えを残すと「過去の会話が透けている」ように見えるので、
            // これから来る文章の骨組みだけを出す
            // 読み上げは statusMessage が受け持つので、骨組み自体は読ませない
            <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
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

          {/* 答えが出そろってから評価を出す。考え中や読み上げ途中には出さない */}
          {!isBusy && streamingText === null && current && (
            <ConsultFeedback
              key={current.id}
              consultId={current.id}
              questionText={current.question}
              answerText={current.answer}
              className="mt-3"
            />
          )}
        </div>
      )}

      {/* 候補ボタン。ここが主役。待っている間は薄く残さず、消す */}
      {phase === "idle" && !isBusy && suggestions.length > 0 && (
        <div
          style={revealClass(140).style}
          className={`flex flex-col gap-2 lg:mt-auto ${revealClass(140).className}`}
        >
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
      </div>
      </div>
      {/* 本文の一番下。ここが見えているかで、下端のぼかしを出すかを決める */}
      <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
      <p role="status" className="sr-only">
        {statusMessage}
      </p>

      {/*
        本文の下端のぼかし。

        スクロール領域は「話しかける」バーの手前で終わる（height で絞っている）ため、
        続きがあるときは、本文がその境目で真横にぶつ切りになっていた（文字の行や
        お店の写真が途中で切れ、表示が壊れて「見切れている」ように見える）。
        境目をまたいで背景色へ溶けるぼかしを敷き、続きが下にあると分かるようにする。

        以前はバーの後ろに同じぼかしを敷いていたが、本文はバーの下まで流れてこない
        （境目で切れる）ので効いていなかった。位置を境目（--consult-bar-space）に合わせた。
        本文の一番下まで見えているときは出さない（isContentEndVisible 参照）。
        lg 以上でサイドバーを開いている間は、サイドバーに掛からないよう右へ逃がす
        （サイドバーの開け閉めと同じ速さ・緩急で動かす）。
        lg 以上はスクロールバー（幅 8px）にも掛からないよう、右端を少し空ける。
        lg 以上はスクロール領域の下端が違う（--consult-bar-space-lg）ので、位置もそれに合わせる
      */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 z-20 h-16 bg-gradient-to-b from-transparent via-nicchyo-base/95 to-nicchyo-base motion-safe:transition-[opacity,left] motion-safe:duration-300 motion-safe:ease-out-soft ${
          isContentEndVisible ? "opacity-0" : "opacity-100"
        } bottom-[calc(var(--consult-bar-space)-2rem)] lg:bottom-[calc(var(--consult-bar-space-lg)-2rem)] lg:right-2 ${
          isHistorySidebarOpen ? "lg:left-80" : ""
        }`}
      />

      {/* 文字入力を大きく既定にし、音声は選べる小さいボタンにする。
          音声シートが出ている間は、押すべきものが2つにならないよう隠す。
          応答待ちの間は隠さず、押せない状態で残す（以前は隠していたが、画面の下半分が
          急に空になって固まったように見え、答えが出るたびにバーが出直して画面が揺れた）。
          外側はビューポート全幅の flex にし、中身だけ max-w-3xl に絞る
          （ConsultClient の <main> と同じ組み方）。lg 以上でサイドバーを開いているときは
          この外側に左パディングを足してチャット欄と同じだけ右へ逃がし、さらに
          中央寄せのままだと「逃がした残りスペースの中でまた中央寄せ」になって
          チャット本体とズレるため、中身を左詰め（margin-left: 0）に切り替える。

          パディングは lg:pl-80（main と同じ 20rem）だけでなく lg:pl-[21rem] にする。
          チャットのスクロール箱は main の 20rem に加えて自分自身の px-4（1rem）を
          持っているため、本文の左端は実際には 21rem 分空いている。ここを 20rem の
          ままにすると、入力欄だけ本文より 1rem 左にずれて見える */}
      <div
        className={`fixed inset-x-0 z-20 flex px-4 motion-safe:transition-[padding-left] motion-safe:duration-300 motion-safe:ease-out-soft ${
          isHistorySidebarOpen ? "lg:pl-[21rem]" : ""
        } ${revealClass(280).className} ${
          speech.isListening || phase === "confirming" ? "hidden" : ""
        }`}
        style={{
          bottom: "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 0.75rem)",
          ...revealClass(280).style,
        }}
      >
        {/* 中央寄せ／左寄せの切り替えは、本文の内側ラッパーと同じく margin-left の計算値で
            持ち、サイドバーの開け閉めに合わせて滑らかにずらす。
            lg 以上は本文と同じ「左30%・右70%」の格子にして、入力欄を右カラムの真下に置く
            （内側の枠はスマホでは display: contents で消し、従来どおりの並びにする） */}
        <div
          className={`mx-auto flex w-full max-w-3xl items-center justify-center gap-3 motion-safe:transition-[margin-left] motion-safe:duration-300 motion-safe:ease-out-soft lg:grid lg:max-w-6xl lg:grid-cols-[30%_minmax(0,1fr)] lg:gap-x-8 ${
            isHistorySidebarOpen ? "lg:ml-0" : "lg:ml-[max(0px,calc((100vw_-_2rem_-_72rem)/2))]"
          }`}
        >
          <div className="contents lg:col-start-2 lg:flex lg:items-center lg:gap-3">
          {/* 文字入力を既定にする。タップして開く一段階を挟まず、
              最初から入力欄を出しておく。音声は騒がしい現地では速いが、
              静かな場所や周りに人がいるときは声を出しにくいため */}
          {/* min-w-0 が無いと入力欄の既定の幅が最小幅になり、幅 320px の端末で
              バーが画面の横にはみ出してマイクのボタンが押せなくなる */}
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-amber-200 bg-white/95 py-1.5 pl-5 pr-1.5 shadow-lg">
            <input
              ref={textInputRef}
              type="text"
              maxLength={1000}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                // 日本語入力の変換確定の Enter で、未確定テキストのまま送信してしまわないようにする
                if (isImeComposing(event)) return;
                if (event.key !== "Enter" || isBusy) return;
                const question = typed.trim();
                if (!question) return;
                event.preventDefault();
                setTyped("");
                void ask(question, "input");
              }}
              // 応答待ちの間は押せない状態で残す。押せないことは送信・マイクのボタンが
              // 薄くなることで伝わるので、入力欄自体は薄くせず「考えよるよ…」を読める濃さで出す
              placeholder={isBusy ? "考えよるよ…" : "（例）今の旬の果物は？"}
              aria-label={`${speaker.name}への質問`}
              enterKeyHint="send"
              disabled={isBusy}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400 disabled:placeholder:text-amber-700"
            />
            <button
              type="button"
              disabled={isBusy || !typed.trim()}
              onClick={() => {
                const question = typed.trim();
                setTyped("");
                void ask(question, "input");
              }}
              aria-label="聞く"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm transition disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {speech.isSupported && (
            <button
              type="button"
              onClick={handleMicTap}
              disabled={isBusy}
              aria-label={speech.isListening ? "とめる" : "音声で聞く"}
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg transition disabled:opacity-50 ${
                speech.isListening
                  ? "bg-red-500 text-white"
                  : "border border-amber-200 bg-white/95 text-amber-800"
              }`}
            >
              <Mic className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          </div>
        </div>
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
        <ConsultSheet
          onClose={cancelVoice}
          backdropClassName="bg-slate-900/40"
          className="px-4 pt-4 shadow-2xl md:max-w-md"
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
        </ConsultSheet>
      )}

      {/*
        話し手を選ぶシート。

        イラストそのものが入口。歩きながら片手で開けるよう、当たり判定を
        絵に持たせている（音声入力は下の「話しかける」ボタンに集約した）。
        選び直しても会話は消さない。話し手が変わるのは次の返答から。

        ナビゲーションバー（z-[9997]）はこのシートより手前に描かれるので、
        下端に寄せたままだと選択肢の下の方がバーに隠れて押せない。
        バーのぶんだけ持ち上げる（画面下部の固定ボタンと同じ計算）。
      */}
      {isSpeakerPickerOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center overflow-y-auto bg-black/30 px-3 pt-16"
          style={{
            paddingBottom: "calc(var(--safe-bottom, 0px) + var(--nav-bar-height) + 0.75rem)",
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-4 pb-5 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-amber-900">だれに聞く？</p>
              <button
                type="button"
                onClick={() => setIsSpeakerPickerOpen(false)}
                aria-label="閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 text-amber-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-3 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {CONSULT_CHARACTERS.map((character) => {
                const isCurrent = character.id === speaker.id;
                return (
                  <li key={character.id}>
                    <button
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => handlePickSpeaker(character.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                        isCurrent
                          ? "border-amber-400 bg-amber-50"
                          : "border-amber-100 bg-white"
                      }`}
                    >
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50">
                        {/* 一覧では next/image の最適化より、行の切り抜き指定をそのまま使う方が崩れない */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={character.image}
                          alt=""
                          className={`h-full w-full object-cover ${character.imageScale}`}
                          style={{ objectPosition: character.imagePosition }}
                          draggable={false}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-slate-900">
                          {character.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {character.subtitle}
                        </span>
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-amber-500 px-2 py-1 text-[11px] font-bold text-white">
                          いま
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
