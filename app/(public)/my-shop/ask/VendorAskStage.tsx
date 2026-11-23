"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { MessageCircleQuestionMark, X } from "lucide-react";
import GrandmaAvatar from "@/app/(public)/consult/components/GrandmaAvatar";
import { DEFAULT_CONSULT_CHARACTER } from "@/app/(public)/consult/data/consultCharacters";
import { resolveGrandmaPose } from "@/lib/grandma/pose";
import { useVendorAskInbox } from "./useVendorAsk";
import VendorHelpInput from "../help/VendorHelpInput";
import HelpAnswerText from "../help/HelpAnswerText";
import HelpProposalCard from "../help/HelpProposalCard";
import HelpMemoryCard from "../help/HelpMemoryCard";
import { CONTACT_HREF, contactMessageFor, useVendorHelpChat } from "../help/useVendorHelpChat";
import { saveContactPrefill } from "@/lib/contact/prefill";
import { countUnit } from "./countLabel";

/** 待っているあいだの、にちよさんの決まったひとこと */
const IDLE_LINE = "今日もおつかれさま！";

/**
 * 出店者トップの主役。
 *
 * 中央に大きなにちよさんが立ち、ふだんは吹き出しで決まったひとことを言っている。
 * 入力が要る質問があるときは、そのひとことの中に「質問が三つ」を言う。
 * その言葉をタップすると質問ページ（/my-shop/ask）へ移り、
 * にちよさんと質問だけの画面で答える。聞くことが無いときはその言葉を出さない。
 *
 * 話し手は既定のにちよさんに固定する。質問文がにちよさんの口調で書かれているため、
 * 相談ページで選んだ別のキャラに切り替えると言葉遣いが合わなくなる。
 *
 * 最後の答えは 10 分のあいだ覚えておき、ページを移って戻ってきても出し直す（lib/vendor/helpChatMemory.ts）。
 * 覚える持ち主は accountId（ログイン中のアカウント）。無ければ店舗で分ける。
 */
export default function VendorAskStage({ vendorId, accountId }: { vendorId: string; accountId?: string }) {
  const inbox = useVendorAskInbox(vendorId);
  const { status, pendingCount } = inbox;
  const showInbox = status === "ready" && pendingCount > 0;
  const help = useVendorHelpChat(accountId ?? vendorId);
  const inputRef = useRef<HTMLInputElement>(null);

  const pose = resolveGrandmaPose({
    isListening: false,
    isStreaming: help.status === "streaming",
    aiStatus: help.status === "thinking" ? "thinking" : "idle",
  });

  return (
    <section aria-label="にちよさん" className="flex flex-col items-center gap-4">
      <div className="consult-appear relative flex">
        <GrandmaAvatar pose={pose} size="hero" character={DEFAULT_CONSULT_CHARACTER} />

      </div>

      <div
        className="consult-greeting w-full max-w-md rounded-card border border-amber-200 bg-white px-5 py-4 shadow-card"
        aria-live="polite"
        // 流れてくる途中の答えを細切れに読み上げないよう、言い終わってからまとめて読ませる
        aria-busy={help.busy}
      >
        {help.question ? (
          <HelpAnswer
            question={help.question}
            answer={help.answer}
            status={help.status}
            proposal={
              help.proposal?.kind === "change" || help.proposal?.kind === "edit" ? (
                <HelpProposalCard
                  vendorId={vendorId}
                  weekDate={inbox.weekDate}
                  proposal={help.proposal}
                  snapshot={inbox.snapshot}
                  snapshotFailed={status === "error"}
                  onSaved={(line) => {
                    help.settleProposal("saved", line);
                    void inbox.refresh();
                  }}
                  onDismiss={(line) => help.settleProposal("dismissed", line)}
                />
              ) : help.proposal?.kind === "memory" ? (
                <HelpMemoryCard
                  key={JSON.stringify(help.proposal.note)}
                  note={help.proposal.note}
                  onSaved={(line) => help.settleProposal("remembered", line)}
                  onDismiss={(line) => help.settleProposal("declined", line)}
                />
              ) : null
            }
            onClose={() => {
              help.close();
              // 閉じるボタンが消えてフォーカスが迷子にならないよう、入力欄へ戻す
              inputRef.current?.focus();
            }}
          />
        ) : (
          <div className="text-center">
            <p className="text-lg font-bold leading-relaxed text-amber-900">{IDLE_LINE}</p>
            {showInbox ? (
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                {/* 見えている文字（「質問が三つ」）をそのままリンクの名前にする。音声操作で見えている言葉を言えば押せるように */}
                <Link
                  href="/my-shop/ask"
                  className="rounded font-bold text-amber-700 underline decoration-amber-300 decoration-2 underline-offset-4 transition active:scale-95 motion-reduce:active:scale-100"
                >
                  <span className="sr-only">にちよさんからの</span>
                  質問が
                  <span data-testid="vendor-ask-inbox-count" className="tabular-nums">
                    {pendingCount}
                  </span>
                  {countUnit(pendingCount)}
                </Link>
                あるき、手が空いたら押してや。
              </p>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                使い方で困ったら、下から聞いてや。
              </p>
            )}
          </div>
        )}
      </div>

      <VendorHelpInput ref={inputRef} busy={help.busy} onAsk={(text) => void help.ask(text)} />
    </section>
  );
}

/** 吹き出しの中身：聞いたことと、にちよさんの答え */
function HelpAnswer({
  question,
  answer,
  status,
  proposal,
  onClose,
}: {
  question: string;
  answer: string;
  status: ReturnType<typeof useVendorHelpChat>["status"];
  /** にちよさんの変更案の確認。あるあいだは問い合わせ先を出さない */
  proposal: ReactNode;
  onClose: () => void;
}) {
  const finished = status === "done" || status === "error";

  return (
    <div>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-nicchyo-ink/70">
          <span className="sr-only">あなたの相談：</span>
          「{question}」
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="相談を閉じる"
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-nicchyo-ink/55 transition active:scale-95 motion-reduce:active:scale-100"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {status === "thinking" ? (
        <div className="mt-3 flex flex-col gap-2">
          <span className="sr-only">にちよさんが考えています</span>
          <span aria-hidden className="consult-skeleton h-3.5 w-4/5 rounded-full" />
          <span aria-hidden className="consult-skeleton h-3.5 w-3/5 rounded-full" style={{ animationDelay: "120ms" }} />
        </div>
      ) : (
        <HelpAnswerText answer={answer} />
      )}

      {proposal}

      {/* にちよさんで解決しないときの逃げ道。答えを読み終えてから出す */}
      {finished && !proposal && (
        <Link
          href={CONTACT_HREF}
          onClick={() => saveContactPrefill(contactMessageFor(question, answer))}
          className="mt-4 flex items-center justify-center gap-1.5 rounded-chip border border-amber-200 px-4 py-2.5 text-sm font-bold text-amber-900 transition active:scale-95 motion-reduce:active:scale-100"
        >
          <MessageCircleQuestionMark className="h-4 w-4 shrink-0" aria-hidden />
          解決しないときは運営に問い合わせる
        </Link>
      )}
    </div>
  );
}
