import { z } from "zod";
import { PAYMENT_OPTIONS, RAIN_OPTIONS, TIME_OPTIONS } from "@/lib/vendor/storeOptions";
import type { AskAnswer, VendorAskSnapshot } from "@/lib/vendor/askQuestions";

// 出店者トップの相談で、にちよさんが出す「お店の情報の変更案」。
//
// 出店者が「営業時間を7時から13時にしたい」のように書いたら、AI は下の関数を呼んで
// 変更案を返す。サーバーはそれを検証して答えの最後に付け、画面は「これでええかえ？」と
// 確認してから保存する（保存は「にちよさんの質問」と同じ askService.saveAskAnswer）。
// AI が直接保存することはない。
//
// 変えられる項目はここで決めた分だけ。写真は会話からは変えない（店舗情報の画面で行う）。

/** 変更案になる答え。会話からは文字と選択肢だけを扱う */
export type HelpProposalAnswer = Extract<
  AskAnswer,
  {
    id:
      | "hours"
      | "payment"
      | "rain"
      | "instagram"
      | "x"
      | "website"
      | "weekly-products"
      | "shop-name"
      | "strength";
  }
>;

/** 確認カードと、保存したあとのひとことで使う項目の名前 */
export const HELP_PROPOSAL_LABELS: Record<HelpProposalAnswer["id"], string> = {
  hours: "営業時間",
  payment: "支払い方法",
  rain: "雨の日の出店",
  instagram: "Instagram",
  x: "X",
  website: "webサイト",
  "weekly-products": "今週出す商品",
  "shop-name": "店名",
  strength: "お店のこだわり",
};

const PAYMENT_KEYS = PAYMENT_OPTIONS.map((option) => option.key) as [string, ...string[]];
const RAIN_KEYS = RAIN_OPTIONS.map((option) => option.key) as [string, ...string[]];

const NOTE_MAX = 200;
const LINK_MAX = 200;
const SHOP_NAME_MAX = 40;
const STRENGTH_MAX = 300;
const PRODUCT_NAME_MAX = 40;
const PRODUCTS_MAX = 10;

/** OpenAI に渡す関数の一覧（function calling） */
export const HELP_PROPOSAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_hours",
      description: "いつもの営業時間（出店時間）の変更案を出す。何時ちょうどの単位だけ",
      parameters: {
        type: "object",
        properties: {
          start_hour: { type: "integer", minimum: 5, maximum: 23, description: "開始の時（5〜23）" },
          end_hour: { type: "integer", minimum: 6, maximum: 24, description: "終了の時（6〜24）" },
        },
        required: ["start_hour", "end_hour"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_payment",
      description: "使える支払い方法の変更案を出す。変更後に使えるものをすべて入れる",
      parameters: {
        type: "object",
        properties: {
          methods: { type: "array", items: { type: "string", enum: PAYMENT_KEYS } },
          note: { type: "string", description: "補足（例: 1000円以上はPayPayのみ）。無ければ空" },
        },
        required: ["methods", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_rain",
      description:
        "雨の日の出店の変更案を出す。outdoor=雨でも出店、cancel=雨天中止、undecided=当日判断（SNSで告知）",
      parameters: {
        type: "object",
        properties: {
          policy: { type: "string", enum: RAIN_KEYS },
          note: { type: "string", description: "補足。無ければ空" },
        },
        required: ["policy", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_link",
      description: "Instagram・X の ID、または webサイトの URL の変更案を出す",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["instagram", "x", "website"] },
          value: { type: "string", description: "ID（@なしでよい）か URL" },
        },
        required: ["kind", "value"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_weekly_products",
      description: "今週（次の日曜）に出す商品の一覧の変更案を出す。変更後の一覧をすべて入れる",
      parameters: {
        type: "object",
        properties: {
          products: { type: "array", items: { type: "string" }, maxItems: PRODUCTS_MAX },
        },
        required: ["products"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_text",
      description: "店名（shop-name）か、お店のこだわり・ええところ（strength）の変更案を出す",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", enum: ["shop-name", "strength"] },
          text: { type: "string" },
        },
        required: ["field", "text"],
        additionalProperties: false,
      },
    },
  },
];

const hour = (h: number) => `${h}:00`;

const trimmed = (max: number) => z.string().trim().max(max);

/** AI の引数（JSON）を検証して、変更案の答えにする */
const TOOL_SCHEMAS: Record<string, (args: unknown) => HelpProposalAnswer | null> = {
  propose_hours: (args) => {
    const parsed = z
      .object({ start_hour: z.number().int().min(5).max(23), end_hour: z.number().int().min(6).max(24) })
      .refine((v) => v.end_hour > v.start_hour)
      .safeParse(args);
    return parsed.success
      ? { id: "hours", start: hour(parsed.data.start_hour), end: hour(parsed.data.end_hour) }
      : null;
  },
  propose_payment: (args) => {
    const parsed = z
      .object({ methods: z.array(z.enum(PAYMENT_KEYS)).min(1).max(PAYMENT_KEYS.length), note: trimmed(NOTE_MAX) })
      .safeParse(args);
    if (!parsed.success) return null;
    const methods = PAYMENT_OPTIONS.map((o) => o.key).filter((key) => parsed.data.methods.includes(key));
    return { id: "payment", methods, note: parsed.data.note };
  },
  propose_rain: (args) => {
    const parsed = z.object({ policy: z.enum(RAIN_KEYS), note: trimmed(NOTE_MAX) }).safeParse(args);
    if (!parsed.success) return null;
    const policy = RAIN_OPTIONS.find((o) => o.key === parsed.data.policy)!.key;
    return { id: "rain", policy, note: parsed.data.note };
  },
  propose_link: (args) => {
    const parsed = z
      .object({ kind: z.enum(["instagram", "x", "website"]), value: trimmed(LINK_MAX).min(1) })
      .safeParse(args);
    if (!parsed.success) return null;
    const { kind, value } = parsed.data;
    if (kind === "website") {
      if (!/^https?:\/\/[^\s]+$/i.test(value)) return null;
      return { id: "website", value };
    }
    const handle = value.replace(/^@/, "");
    if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
    return { id: kind, value: handle };
  },
  propose_weekly_products: (args) => {
    const parsed = z
      .object({ products: z.array(trimmed(PRODUCT_NAME_MAX)).max(PRODUCTS_MAX) })
      .safeParse(args);
    if (!parsed.success) return null;
    const products = [...new Set(parsed.data.products.filter(Boolean))];
    return { id: "weekly-products", products };
  },
  propose_text: (args) => {
    const parsed = z
      .discriminatedUnion("field", [
        z.object({ field: z.literal("shop-name"), text: trimmed(SHOP_NAME_MAX).min(1) }),
        z.object({ field: z.literal("strength"), text: trimmed(STRENGTH_MAX).min(1) }),
      ])
      .safeParse(args);
    return parsed.success ? { id: parsed.data.field, text: parsed.data.text } : null;
  },
};

/**
 * AI が呼んだ関数を変更案にする。知らない関数・壊れた引数・範囲外の値は null。
 * 複数呼ばれたときは、最初に読めたものだけを使う（確認は1つずつ）
 */
export function proposalFromToolCalls(
  calls: { name: string; arguments: string }[]
): HelpProposalAnswer | null {
  for (const call of calls) {
    const toAnswer = Object.hasOwn(TOOL_SCHEMAS, call.name) ? TOOL_SCHEMAS[call.name] : undefined;
    if (!toAnswer) continue;
    let args: unknown;
    try {
      args = JSON.parse(call.arguments || "{}");
    } catch {
      continue;
    }
    const answer = toAnswer(args);
    if (answer) return answer;
  }
  return null;
}

/** 答えの最後に付ける変更案のデータ */
export function serializeProposal(answer: HelpProposalAnswer): string {
  return JSON.stringify({ type: "proposal", answer });
}

const ProposalFrameSchema = z.object({
  type: z.literal("proposal"),
  answer: z.discriminatedUnion("id", [
    z.object({ id: z.literal("hours"), start: z.enum(TIME_OPTIONS as [string, ...string[]]), end: z.enum(TIME_OPTIONS as [string, ...string[]]) }),
    z.object({ id: z.literal("payment"), methods: z.array(z.enum(PAYMENT_KEYS)), note: z.string().max(NOTE_MAX) }),
    z.object({ id: z.literal("rain"), policy: z.enum(RAIN_KEYS), note: z.string().max(NOTE_MAX) }),
    z.object({ id: z.literal("instagram"), value: z.string().max(LINK_MAX) }),
    z.object({ id: z.literal("x"), value: z.string().max(LINK_MAX) }),
    z.object({ id: z.literal("website"), value: z.string().max(LINK_MAX) }),
    z.object({ id: z.literal("weekly-products"), products: z.array(z.string().max(PRODUCT_NAME_MAX)).max(PRODUCTS_MAX) }),
    z.object({ id: z.literal("shop-name"), text: z.string().max(SHOP_NAME_MAX) }),
    z.object({ id: z.literal("strength"), text: z.string().max(STRENGTH_MAX) }),
  ]),
});

/** 画面側で、答えの最後に付いた変更案のデータを読む。読めなければ null */
export function parseProposalFrame(raw: string): HelpProposalAnswer | null {
  try {
    const parsed = ProposalFrameSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data.answer as HelpProposalAnswer) : null;
  } catch {
    return null;
  }
}

/**
 * 変更案をいまの登録内容に重ねる。確認カードの入力欄（AskInput）は登録内容から
 * 初期値を取るので、これを渡すと変更案が入った状態で開き、その場で直せる
 */
export function applyProposalToSnapshot(
  snapshot: VendorAskSnapshot,
  answer: HelpProposalAnswer
): VendorAskSnapshot {
  switch (answer.id) {
    case "hours":
      return { ...snapshot, businessHoursStart: answer.start, businessHoursEnd: answer.end };
    case "payment":
      return { ...snapshot, paymentMethods: answer.methods, paymentNote: answer.note };
    case "rain":
      return { ...snapshot, rainPolicy: answer.policy, rainNote: answer.note, rainAnswered: true };
    case "instagram":
      return { ...snapshot, instagram: answer.value };
    case "x":
      return { ...snapshot, snsX: answer.value };
    case "website":
      return { ...snapshot, website: answer.value };
    case "weekly-products":
      return {
        ...snapshot,
        weekly: { isOpen: snapshot.weekly?.isOpen ?? null, products: answer.products },
      };
    case "shop-name":
      return { ...snapshot, shopName: answer.text };
    case "strength":
      return { ...snapshot, strength: answer.text };
  }
}
