import type { PaymentMethod, RainPolicy } from "@/app/vendor/_types";

/**
 * 出店者ページで、にちよさんが出店者に聞く質問の一覧。
 *
 * 質問文は運営が事前に用意する（AI では生成しない）。ここが唯一の定義で、
 * 「何を聞くか」「答え済みかの判定」「どの順で出すか」をすべて持つ。
 * 保存先への書き込みは app/vendor/_services/askService.ts が行う。
 *
 * - urgent : 急ぎの質問。来訪者が欲しがるのに、まだ入力されていない情報
 * - weekly : いつもの質問。毎週聞く（その週に答えたら出さない）
 * - maniac : マニアックな質問。急ぎが片付いてから、1回に1つだけ
 */

export type AskQuestionId =
  | "weekly-products"
  | "hours"
  | "signature"
  | "signature-pr"
  | "payment"
  | "instagram"
  | "website"
  | "rain"
  | "strength"
  | "motivation"
  | "years"
  | "sunday-love";

export type AskTier = "urgent" | "weekly" | "maniac";

/** 画面が出す入力欄の種類。質問ごとに1つ決まる */
export type AskInputKind =
  | "product-list"
  | "hours"
  | "signature"
  | "payment"
  | "rain"
  | "handle"
  | "url"
  | "long-text"
  | "years";

/** 1回に出す質問の数。出店者の負担を増やさないための上限 */
export const ASK_LIMIT = 3;

/** マニアックな質問を1回に出してよい数 */
export const ASK_MANIAC_LIMIT = 1;

/** 「答え済みか」を判定するために必要な、出店者の今の状態 */
export type VendorAskSnapshot = {
  businessHoursStart?: string;
  businessHoursEnd?: string;
  /** 看板商品（vendors.signature_product_name と同じ名前の商品）。まだ決めていなければ無い */
  signatureProduct?: { name: string; imageUrl?: string; description?: string };
  /** 看板商品を決める前の入力欄の初期値。登録済みの先頭の商品名 */
  signatureNameHint?: string;
  paymentMethods: PaymentMethod[];
  paymentNote?: string;
  instagram?: string;
  website?: string;
  rainPolicy: RainPolicy;
  rainNote?: string;
  /** 雨の日の質問に答えたか。rainPolicy の既定値（当日判断）のままとは区別する */
  rainAnswered: boolean;
  strength?: string;
  motivation?: string;
  yearsRunning?: number | null;
  sundayLove?: string;
  /** 今週（次の日曜）の回答。行が無ければ null */
  weekly: { isOpen: boolean | null; products: string[] } | null;
};

export type AskQuestion = {
  id: AskQuestionId;
  tier: AskTier;
  text: string;
  input: AskInputKind;
  placeholder?: string;
  /** 聞く意味がある状態か。省略時は常に true */
  isApplicable?: (snapshot: VendorAskSnapshot) => boolean;
  /** すでに答えてあるか */
  isAnswered: (snapshot: VendorAskSnapshot) => boolean;
};

const filled = (value: string | undefined | null) => !!value?.trim();

/**
 * 表示順そのものが優先順。tier ごとに、この並びで出す。
 */
export const ASK_QUESTIONS: readonly AskQuestion[] = [
  // いつもの質問
  {
    id: "weekly-products",
    tier: "weekly",
    text: "今週はどんな商品を出品するかえ？",
    input: "product-list",
    placeholder: "（例）トマト",
    isAnswered: (s) => (s.weekly?.products.length ?? 0) > 0,
  },

  // 急ぎの質問
  {
    id: "hours",
    tier: "urgent",
    text: "いつも何時から何時くらいまで出店しちゅう？",
    input: "hours",
    isAnswered: (s) => filled(s.businessHoursStart) && filled(s.businessHoursEnd),
  },
  {
    id: "signature",
    tier: "urgent",
    text: "このお店の看板商品を教えてや！",
    input: "signature",
    placeholder: "（例）山田農園のトマト",
    isAnswered: (s) => !!s.signatureProduct && filled(s.signatureProduct.imageUrl),
  },
  {
    id: "signature-pr",
    tier: "urgent",
    text: "商品のPR（紹介）をしてや！",
    input: "long-text",
    placeholder: "（例）朝どれの完熟で、甘みがぎゅっと詰まっちゅうよ",
    // 紹介する相手（看板商品）が登録されてから聞く
    isApplicable: (s) => !!s.signatureProduct,
    isAnswered: (s) => filled(s.signatureProduct?.description),
  },
  {
    id: "payment",
    tier: "urgent",
    text: "支払方法はなにがある？",
    input: "payment",
    isAnswered: (s) => s.paymentMethods.length > 0 || filled(s.paymentNote),
  },
  {
    id: "instagram",
    tier: "urgent",
    text: "インスタグラムをやっちょったら、IDを教えてや！",
    input: "handle",
    placeholder: "@username",
    isAnswered: (s) => filled(s.instagram),
  },
  {
    id: "website",
    tier: "urgent",
    text: "webサイトも登録できるきね！",
    input: "url",
    placeholder: "https://example.com",
    isAnswered: (s) => filled(s.website),
  },
  {
    id: "rain",
    tier: "urgent",
    text: "雨の日はいつも出店しゆう？",
    input: "rain",
    // 既定値の「当日判断」だけでは、本人が答えたのか未回答なのか区別できない
    isAnswered: (s) => s.rainAnswered,
  },

  // マニアックな質問
  {
    id: "strength",
    tier: "maniac",
    text: "このお店のええところを教えてや",
    input: "long-text",
    isAnswered: (s) => filled(s.strength),
  },
  {
    id: "motivation",
    tier: "maniac",
    text: "どんな思いで出店しちゅうが？",
    input: "long-text",
    isAnswered: (s) => filled(s.motivation),
  },
  {
    id: "years",
    tier: "maniac",
    text: "このお店は何年くらい続けてきちゅう？",
    input: "years",
    isAnswered: (s) => s.yearsRunning != null,
  },
  {
    id: "sunday-love",
    tier: "maniac",
    text: "日曜市のなにが好き？",
    input: "long-text",
    isAnswered: (s) => filled(s.sundayLove),
  },
];

export const ASK_QUESTION_BY_ID: ReadonlyMap<AskQuestionId, AskQuestion> = new Map(
  ASK_QUESTIONS.map((question) => [question.id, question])
);

/**
 * 今回の出店者に出す質問を、上限つきで選ぶ。
 *
 * 順序は「いつもの質問」→「急ぎの質問」→「マニアックな質問」。
 * いつもの質問を先頭にするのは、急ぎが溜まっている新規の出店者でも
 * 今週の分だけは聞き逃さないため。マニアックな質問は、急ぎに残りが無く
 * なってから、1回に1つだけ出す。
 *
 * skippedIds は「あとで」と答えた質問。同じ週のうちは出し直さない。
 * allowManiac は、1問ずつ選び直すときに「今回すでにマニアックな質問を出した」
 * ことを伝えるためのもの（false ならマニアックな質問は選ばない）。
 */
export function pickQuestions(
  snapshot: VendorAskSnapshot,
  options: {
    limit?: number;
    skippedIds?: readonly AskQuestionId[];
    allowManiac?: boolean;
  } = {}
): AskQuestion[] {
  const { limit = ASK_LIMIT, skippedIds = [], allowManiac = true } = options;
  const skipped = new Set(skippedIds);

  const pending = ASK_QUESTIONS.filter(
    (question) =>
      !skipped.has(question.id) &&
      (question.isApplicable?.(snapshot) ?? true) &&
      !question.isAnswered(snapshot)
  );

  const weekly = pending.filter((question) => question.tier === "weekly");
  const urgent = pending.filter((question) => question.tier === "urgent");
  const maniac = pending.filter((question) => question.tier === "maniac");

  return [
    ...weekly,
    ...urgent,
    ...(allowManiac && urgent.length === 0 ? maniac.slice(0, ASK_MANIAC_LIMIT) : []),
  ].slice(0, limit);
}

/** 出店者が1つの質問に答えた内容。保存は askService.saveAskAnswer が行う */
export type AskAnswer =
  | { id: "weekly-products"; products: string[] }
  | { id: "hours"; start: string; end: string }
  | { id: "signature"; name: string; imageFile: File | null }
  | { id: "signature-pr"; text: string }
  | { id: "payment"; methods: PaymentMethod[]; note: string }
  | { id: "instagram"; value: string }
  | { id: "website"; value: string }
  | { id: "rain"; policy: RainPolicy; note: string }
  | { id: "strength"; text: string }
  | { id: "motivation"; text: string }
  | { id: "years"; years: number }
  | { id: "sunday-love"; text: string };
