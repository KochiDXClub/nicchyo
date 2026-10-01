import type { PaymentMethod, RainPolicy } from "@/app/vendor/_types";
import { PAYMENT_OPTIONS, RAIN_OPTIONS } from "@/lib/vendor/storeOptions";

/**
 * 出店者に、にちよさんが聞く質問の一覧。
 *
 * 質問文は運営が事前に用意する（AI では生成しない）。ここが唯一の定義で、
 * 「何を聞くか」「答え済みかの判定」「答えの要約」「どの順で出すか」をすべて持つ。
 * 保存先への書き込みは app/vendor/_services/askService.ts が行う。
 *
 * 使われ方は2つある。
 * - 出店者トップ（/my-shop）: 入力が要る質問の数を「質問が◯つ」で知らせ、
 *   質問ページ（/my-shop/ask）で順に聞く（pendingQuestions）
 * - 店舗情報の編集（/vendor/store）: すべての質問を一覧にして、いつでも答え直せる
 *
 * tier は、トップで聞く順番を決める（weekly → urgent → maniac）。
 * - weekly  : いつもの質問。毎週聞く（その週に答えたら出さない）
 * - urgent  : 急ぎの質問。来訪者が欲しがるのに、まだ入力されていない情報
 * - maniac  : マニアックな質問。急ぎのあとに聞く
 * - profile : 店舗情報の基本項目。トップでは聞かず、編集画面だけに出す
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
  | "sunday-love"
  | "shop-photo"
  | "shop-name"
  | "category"
  | "style"
  | "owner"
  | "products"
  | "schedule"
  | "x";

export type AskTier = "urgent" | "weekly" | "maniac" | "profile";

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
  | "years"
  | "line-text"
  | "photo"
  | "category"
  | "style"
  | "owner"
  | "product-prices"
  | "schedule";

/** 「答え済みか」を判定するために必要な、出店者の今の状態 */
export type VendorAskSnapshot = {
  shopName?: string;
  shopImageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  /** 選べるカテゴリ。出店者の状態ではなく、カテゴリの入力欄の選択肢 */
  categoryOptions: { id: string; name: string }[];
  /** 出店スタイルの一言 */
  style?: string;
  styleTags: string[];
  ownerName?: string;
  ownerNamePublic: boolean;
  /** 主な商品と値段（店舗情報の編集画面の「主な商品」） */
  products: { name: string; price: number | null }[];
  schedule: string[];
  businessHoursStart?: string;
  businessHoursEnd?: string;
  /** 看板商品（vendors.signature_product_name と同じ名前の商品）。まだ決めていなければ無い */
  signatureProduct?: { name: string; imageUrl?: string; description?: string };
  /** 看板商品を決める前の入力欄の初期値。登録済みの先頭の商品名 */
  signatureNameHint?: string;
  paymentMethods: PaymentMethod[];
  paymentNote?: string;
  instagram?: string;
  snsX?: string;
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
  /** 一覧で質問の頭に付ける絵。編集画面の見た目のためだけに使う */
  emoji: string;
  text: string;
  input: AskInputKind;
  placeholder?: string;
  /** 聞く意味がある状態か。省略時は常に true */
  isApplicable?: (snapshot: VendorAskSnapshot) => boolean;
  /** すでに答えてあるか */
  isAnswered: (snapshot: VendorAskSnapshot) => boolean;
  /** 答えを一覧に出すときの短い要約。答えが無ければ null */
  summary: (snapshot: VendorAskSnapshot) => string | null;
};

const filled = (value: string | undefined | null) => !!value?.trim();
const textOrNull = (value: string | undefined | null) => (filled(value) ? value!.trim() : null);

const yen = (price: number | null) => (price == null ? "" : ` ¥${price.toLocaleString("ja-JP")}`);

/** 一覧に出すときに、長い並びを「ほか◯件」で切る */
function joinWithRest(items: string[], visible = 3): string | null {
  if (items.length === 0) return null;
  const head = items.slice(0, visible).join("、");
  return items.length > visible ? `${head} ほか${items.length - visible}件` : head;
}

/**
 * 表示順そのものが優先順。tier ごとに、この並びで出す。
 * 編集画面での並びは、下の ASK_GROUPS が決める。
 */
export const ASK_QUESTIONS: readonly AskQuestion[] = [
  // いつもの質問
  {
    id: "weekly-products",
    tier: "weekly",
    emoji: "🛒",
    text: "今週はどんな商品を出品するかえ？",
    input: "product-list",
    placeholder: "（例）トマト",
    isAnswered: (s) => (s.weekly?.products.length ?? 0) > 0,
    summary: (s) => joinWithRest(s.weekly?.products ?? []),
  },

  // 急ぎの質問
  {
    id: "hours",
    tier: "urgent",
    emoji: "⏰",
    text: "いつも何時から何時くらいまで出店しちゅう？",
    input: "hours",
    isAnswered: (s) => filled(s.businessHoursStart) && filled(s.businessHoursEnd),
    summary: (s) =>
      filled(s.businessHoursStart) && filled(s.businessHoursEnd)
        ? `${s.businessHoursStart}〜${s.businessHoursEnd}`
        : null,
  },
  {
    id: "signature",
    tier: "urgent",
    emoji: "🌟",
    text: "このお店の看板商品を教えてや！",
    input: "signature",
    placeholder: "（例）山田農園のトマト",
    isAnswered: (s) => !!s.signatureProduct && filled(s.signatureProduct.imageUrl),
    summary: (s) => textOrNull(s.signatureProduct?.name),
  },
  {
    id: "signature-pr",
    tier: "urgent",
    emoji: "📣",
    text: "商品のPR（紹介）をしてや！",
    input: "long-text",
    placeholder: "（例）朝どれの完熟で、甘みがぎゅっと詰まっちゅうよ",
    // 紹介する相手（看板商品）が登録されてから聞く
    isApplicable: (s) => !!s.signatureProduct,
    isAnswered: (s) => filled(s.signatureProduct?.description),
    summary: (s) => textOrNull(s.signatureProduct?.description),
  },
  {
    id: "payment",
    tier: "urgent",
    emoji: "💴",
    text: "支払方法はなにがある？",
    input: "payment",
    isAnswered: (s) => s.paymentMethods.length > 0 || filled(s.paymentNote),
    summary: (s) => {
      const labels = s.paymentMethods.map(
        (method) => PAYMENT_OPTIONS.find((option) => option.key === method)?.label ?? method
      );
      if (filled(s.paymentNote)) labels.push(s.paymentNote!.trim());
      return labels.length > 0 ? labels.join("・") : null;
    },
  },
  {
    id: "instagram",
    tier: "urgent",
    emoji: "📷",
    text: "インスタグラムをやっちょったら、IDを教えてや！",
    input: "handle",
    placeholder: "@username",
    isAnswered: (s) => filled(s.instagram),
    summary: (s) => textOrNull(s.instagram),
  },
  {
    id: "website",
    tier: "urgent",
    emoji: "🌐",
    text: "webサイトも登録できるきね！",
    input: "url",
    placeholder: "https://example.com",
    isAnswered: (s) => filled(s.website),
    summary: (s) => textOrNull(s.website),
  },
  {
    id: "rain",
    tier: "urgent",
    emoji: "☔",
    text: "雨の日はいつも出店しゆう？",
    input: "rain",
    // 既定値の「当日判断」だけでは、本人が答えたのか未回答なのか区別できない
    isAnswered: (s) => s.rainAnswered,
    summary: (s) => {
      if (!s.rainAnswered) return null;
      const label = RAIN_OPTIONS.find((option) => option.key === s.rainPolicy)?.label;
      return [label, textOrNull(s.rainNote)].filter(Boolean).join("／") || null;
    },
  },

  // マニアックな質問
  {
    id: "strength",
    tier: "maniac",
    emoji: "✨",
    text: "このお店のええところを教えてや",
    input: "long-text",
    isAnswered: (s) => filled(s.strength),
    summary: (s) => textOrNull(s.strength),
  },
  {
    id: "motivation",
    tier: "maniac",
    emoji: "🔥",
    text: "どんな思いで出店しちゅうが？",
    input: "long-text",
    isAnswered: (s) => filled(s.motivation),
    summary: (s) => textOrNull(s.motivation),
  },
  {
    id: "years",
    tier: "maniac",
    emoji: "📅",
    text: "このお店は何年くらい続けてきちゅう？",
    input: "years",
    isAnswered: (s) => s.yearsRunning != null,
    summary: (s) => (s.yearsRunning != null ? `${s.yearsRunning}年くらい` : null),
  },
  {
    id: "sunday-love",
    tier: "maniac",
    emoji: "💛",
    text: "日曜市のなにが好き？",
    input: "long-text",
    isAnswered: (s) => filled(s.sundayLove),
    summary: (s) => textOrNull(s.sundayLove),
  },

  // 店舗情報の基本項目（編集画面だけ）。質問文はにちよさんの口調で新しく書いたもの
  {
    id: "shop-photo",
    tier: "profile",
    emoji: "📸",
    text: "お店の写真を見せてや！",
    input: "photo",
    isAnswered: (s) => filled(s.shopImageUrl),
    summary: (s) => (filled(s.shopImageUrl) ? "写真あり" : null),
  },
  {
    id: "shop-name",
    tier: "profile",
    emoji: "🏪",
    text: "お店の名前はなんちゅうが？",
    input: "line-text",
    placeholder: "（例）山田農園",
    isAnswered: (s) => filled(s.shopName),
    summary: (s) => textOrNull(s.shopName),
  },
  {
    id: "category",
    tier: "profile",
    emoji: "🧺",
    text: "どんなもんを売りゆう？",
    input: "category",
    isAnswered: (s) => filled(s.categoryId),
    summary: (s) => textOrNull(s.categoryName),
  },
  {
    id: "style",
    tier: "profile",
    emoji: "🎪",
    text: "お店のスタイルを教えてや！",
    input: "style",
    isAnswered: (s) => s.styleTags.length > 0 || filled(s.style),
    summary: (s) => {
      const parts = [...s.styleTags];
      if (filled(s.style)) parts.push(s.style!.trim());
      return parts.length > 0 ? parts.join("・") : null;
    },
  },
  {
    id: "owner",
    tier: "profile",
    emoji: "🙋",
    text: "店主さんのお名前は？（出さんでもえいよ）",
    input: "owner",
    isAnswered: (s) => filled(s.ownerName),
    summary: (s) =>
      filled(s.ownerName) ? `${s.ownerName!.trim()}（${s.ownerNamePublic ? "公開" : "非公開"}）` : null,
  },
  {
    id: "products",
    tier: "profile",
    emoji: "🥕",
    text: "主な商品と値段を教えてや！",
    input: "product-prices",
    isAnswered: (s) => s.products.length > 0,
    summary: (s) => joinWithRest(s.products.map((product) => `${product.name}${yen(product.price)}`)),
  },
  {
    id: "schedule",
    tier: "profile",
    emoji: "🗓️",
    text: "出店しゆうのはいつ？",
    input: "schedule",
    isAnswered: (s) => s.schedule.length > 0,
    summary: (s) => joinWithRest(s.schedule, 4),
  },
  {
    id: "x",
    tier: "profile",
    emoji: "🐦",
    text: "X（旧Twitter）はやっちょる？",
    input: "handle",
    placeholder: "@username",
    isAnswered: (s) => filled(s.snsX),
    summary: (s) => textOrNull(s.snsX),
  },
];

export const ASK_QUESTION_BY_ID: ReadonlyMap<AskQuestionId, AskQuestion> = new Map(
  ASK_QUESTIONS.map((question) => [question.id, question])
);

/**
 * 編集画面での章立てと、章の中の並び。
 * すべての質問がどれかの章に入っていること（テストで確かめる）。
 */
export const ASK_GROUPS: readonly {
  key: string;
  title: string;
  emoji: string;
  ids: readonly AskQuestionId[];
}[] = [
  { key: "face", title: "お店の顔", emoji: "🏪", ids: ["shop-photo", "shop-name", "category", "style", "owner"] },
  { key: "goods", title: "品ぞろえ", emoji: "🥕", ids: ["weekly-products", "products", "signature", "signature-pr"] },
  { key: "market", title: "出店のこと", emoji: "🗓️", ids: ["hours", "schedule", "rain", "payment"] },
  { key: "link", title: "つながり", emoji: "🔗", ids: ["instagram", "x", "website"] },
  { key: "heart", title: "こだわり", emoji: "💛", ids: ["strength", "motivation", "years", "sunday-love"] },
];

/** トップで聞く順。いつもの質問（今週の分）を先に、マニアックな質問は最後に */
const PENDING_TIER_ORDER = ["weekly", "urgent", "maniac"] as const;

/**
 * いま入力が要る質問を、聞く順にすべて返す（profile の質問は含めない）。
 *
 * 出店者トップの「質問が◯つ」の数と、質問ページで聞く順番の両方に使う。
 * いつもの質問を先頭にするのは、急ぎが溜まっている新規の出店者でも、
 * 今週の分だけは聞き逃さないため。
 */
export function pendingQuestions(snapshot: VendorAskSnapshot): AskQuestion[] {
  return PENDING_TIER_ORDER.flatMap((tier) =>
    ASK_QUESTIONS.filter(
      (question) =>
        question.tier === tier &&
        (question.isApplicable?.(snapshot) ?? true) &&
        !question.isAnswered(snapshot)
    )
  );
}

/** 編集画面で「いま聞ける」質問（聞く意味がある状態のもの）を、章の並びで返す */
export function studioQuestions(snapshot: VendorAskSnapshot) {
  return ASK_GROUPS.map((group) => ({
    ...group,
    questions: group.ids
      .map((id) => ASK_QUESTION_BY_ID.get(id))
      .filter((question): question is AskQuestion => !!question)
      .filter((question) => question.isApplicable?.(snapshot) ?? true),
  }));
}

/** 入れた値を「消す」ことができる質問（つながりと店舗写真）。消すときは空の答えを送る */
const CLEARABLE_IDS: readonly AskQuestionId[] = ["instagram", "x", "website", "shop-photo", "owner", "category"];

export const isClearable = (id: AskQuestionId) => CLEARABLE_IDS.includes(id);

/** 質問を「消す」ための、空の答え */
export function emptyAnswerFor(id: AskQuestionId): AskAnswer | null {
  switch (id) {
    case "instagram":
    case "x":
    case "website":
      return { id, value: "" };
    case "shop-photo":
      return { id, imageFile: null };
    case "owner":
      // 名前を消すときは、公開の設定も外しておく
      return { id, name: "", isPublic: false };
    case "category":
      return { id, categoryId: "" };
    default:
      return null;
  }
}

/**
 * その答えが「この答えを消す」（空の答え）かどうか。emptyAnswerFor と対になるので、
 * 消せる質問を増やしたら、ここも一緒に足す（テストで両方がそろっているか確かめている）
 */
export function isClearAnswer(answer: AskAnswer): boolean {
  switch (answer.id) {
    case "instagram":
    case "x":
    case "website":
      return !answer.value.trim();
    case "shop-photo":
      return !answer.imageFile;
    case "owner":
      return !answer.name.trim();
    case "category":
      return !answer.categoryId;
    default:
      return false;
  }
}

/** 出店者が1つの質問に答えた内容。保存は askService.saveAskAnswer が行う */
export type AskAnswer =
  | { id: "weekly-products"; products: string[] }
  | { id: "hours"; start: string; end: string }
  | { id: "signature"; name: string; imageFile: File | null }
  | { id: "signature-pr"; text: string }
  | { id: "payment"; methods: PaymentMethod[]; note: string }
  | { id: "instagram"; value: string }
  | { id: "x"; value: string }
  | { id: "website"; value: string }
  | { id: "rain"; policy: RainPolicy; note: string }
  | { id: "strength"; text: string }
  | { id: "motivation"; text: string }
  | { id: "years"; years: number }
  | { id: "sunday-love"; text: string }
  | { id: "shop-photo"; imageFile: File | null }
  | { id: "shop-name"; text: string }
  | { id: "category"; categoryId: string }
  | { id: "style"; tags: string[]; note: string }
  | { id: "owner"; name: string; isPublic: boolean }
  | { id: "products"; items: { name: string; price: number | null }[] }
  | { id: "schedule"; items: string[] };
