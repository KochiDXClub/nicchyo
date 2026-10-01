import { ASK_QUESTIONS, type AskQuestion, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";

/** 聞く順。いつもの質問（今週の分）を先に、マニアックな質問は最後に */
const TIER_ORDER = ["weekly", "urgent", "maniac"] as const;

/**
 * いま入力が要る質問を、聞く順にすべて返す。
 *
 * 出店者トップの「！」に出す数（受信箱の数）と、質問ページで聞く順番の両方に使う。
 * 数は「まだ答えていない質問の数」をそのまま出す。「あとで」にしても答えたことには
 * ならないので、数は減らさない。
 */
export function pendingQuestions(snapshot: VendorAskSnapshot): AskQuestion[] {
  return TIER_ORDER.flatMap((tier) =>
    ASK_QUESTIONS.filter(
      (question) =>
        question.tier === tier &&
        (question.isApplicable?.(snapshot) ?? true) &&
        !question.isAnswered(snapshot)
    )
  );
}

/**
 * 質問の数の数え方。「つ」は9までしか自然に使えないので、10からは「こ」にする
 * （新しい出店者だと、はじめは10を超えることがある）
 */
export function countUnit(count: number): string {
  return count < 10 ? "つ" : "こ";
}

export function countLabel(count: number): string {
  return `${count}${countUnit(count)}`;
}
