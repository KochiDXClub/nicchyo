"use client";

import { useState } from "react";
import Link from "next/link";
import AskInput from "@/components/vendor/ask/AskInputs";
import { ASK_QUESTION_BY_ID, type AskAnswer, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import {
  applyProposalToSnapshot,
  HELP_PROPOSAL_LABELS,
  type HelpProposal,
} from "@/lib/vendor/helpProposals";
import { AskUserFacingError, saveAskAnswer } from "@/app/vendor/_services/askService";

type Props = {
  vendorId: string;
  weekDate: string;
  proposal: HelpProposal;
  /** いまの登録内容。読めていなければ null、読めなかったら failed */
  snapshot: VendorAskSnapshot | null;
  snapshotFailed: boolean;
  onSaved: (line: string) => void;
  onDismiss: (line: string) => void;
};

const SAVE_ERROR = "うまく保存できんかった。もういっぺんやってみてや。";

/**
 * にちよさんの変更案の確認。「これでええかえ？」と聞いて、案を入れた入力欄を出す。
 * 新しい値が分からず、変えたい項目だけ分かったとき（edit）は、いまの値のまま入力欄を開く。
 * 出店者はその場で直してから保存できる。保存は「にちよさんの質問」と同じ saveAskAnswer。
 */
export default function HelpProposalCard({
  vendorId,
  weekDate,
  proposal,
  snapshot,
  snapshotFailed,
  onSaved,
  onDismiss,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = proposal.kind === "change" ? proposal.answer.id : proposal.field;
  const question = ASK_QUESTION_BY_ID.get(field);
  const label = HELP_PROPOSAL_LABELS[field];
  // 何から何に変わるのか分かるよう、いまの登録内容も並べる（edit は入力欄がいまの値なので要らない）
  const current = snapshot && question ? question.summary(snapshot) : null;
  const inputSnapshot =
    snapshot && proposal.kind === "change" ? applyProposalToSnapshot(snapshot, proposal.answer) : snapshot;

  const save = async (answer: AskAnswer) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveAskAnswer(vendorId, weekDate, answer);
      onSaved(`${label}を変えちょいたで！`);
    } catch (err) {
      setError(err instanceof AskUserFacingError ? err.message : SAVE_ERROR);
      setSaving(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${label}の変更の確認`}
      className="mt-4 rounded-card border border-amber-200 bg-nicchyo-base px-4 py-4"
    >
      <p className="text-sm font-bold text-amber-900">
        {proposal.kind === "change" ? `${label}、これでええかえ？` : `${label}、どう変えるかえ？`}
        <span className="block text-xs font-normal text-amber-900/70">
          {proposal.kind === "change" ? "直してから保存してもかまんきね。" : "いまの内容から直して保存してや。"}
        </span>
      </p>
      {snapshot && proposal.kind === "change" && (
        <p className="mt-2 text-xs leading-relaxed text-nicchyo-ink/70">
          いまは：{current ?? "まだ登録されていない"}
        </p>
      )}

      <div className="mt-3">
        {inputSnapshot && question ? (
          <AskInput
            key={JSON.stringify(proposal)}
            question={question}
            snapshot={inputSnapshot}
            saving={saving}
            onSubmit={(answer) => void save(answer)}
            onSkip={() => onDismiss("ほいたら、そのままにしちょくね。")}
            skipLabel="やめる"
          />
        ) : snapshotFailed || !question ? (
          <p className="text-sm leading-relaxed text-nicchyo-ink/70">
            いまお店の情報を読めんかったき、
            <Link href="/vendor/store" className="font-bold text-amber-900 underline">
              店舗情報の画面
            </Link>
            から変えてや。
          </p>
        ) : (
          <span aria-hidden className="consult-skeleton block h-10 w-full rounded-full" />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
