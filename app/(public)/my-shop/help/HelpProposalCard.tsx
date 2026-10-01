"use client";

import { useState } from "react";
import Link from "next/link";
import AskInput from "@/components/vendor/ask/AskInputs";
import { ASK_QUESTION_BY_ID, type AskAnswer, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import {
  applyProposalToSnapshot,
  HELP_PROPOSAL_LABELS,
  type HelpProposalAnswer,
} from "@/lib/vendor/helpProposals";
import { AskUserFacingError, saveAskAnswer } from "@/app/vendor/_services/askService";

type Props = {
  vendorId: string;
  weekDate: string;
  proposal: HelpProposalAnswer;
  /** いまの登録内容。読めていなければ null、読めなかったら failed */
  snapshot: VendorAskSnapshot | null;
  snapshotFailed: boolean;
  onSaved: (line: string) => void;
  onDismiss: (line: string) => void;
};

const SAVE_ERROR = "うまく保存できんかった。もういっぺんやってみてや。";

/**
 * にちよさんの変更案の確認。「これでええかえ？」と聞いて、案を入れた入力欄を出す。
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
  const question = ASK_QUESTION_BY_ID.get(proposal.id);
  const label = HELP_PROPOSAL_LABELS[proposal.id];

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
        {label}、これでええかえ？
        <span className="block text-xs font-normal text-amber-900/70">直してから保存してもかまんきね。</span>
      </p>

      <div className="mt-3">
        {snapshot && question ? (
          <AskInput
            key={JSON.stringify(proposal)}
            question={question}
            snapshot={applyProposalToSnapshot(snapshot, proposal)}
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
