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
//
// もう1つ、来訪者に伝えるとよいこと（「雨の日は10時で閉める」など）を出店者が話したら、
// にちよさんが「覚えちょいてもかまん？」と聞く案（propose_memory）も出す。覚えるのは
// 出店者が確かめてから（保存先はにちよさんのノート。/api/vendor/ai-notes）。

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

/** 変えられる項目 */
export type HelpProposalField = HelpProposalAnswer["id"];

/**
 * 答えの最後に付く案。
 * - change: 新しい値まで分かったときの変更案（入力欄に案を入れて開く）
 * - edit: 変えたい項目だけ分かったとき（いまの値のまま入力欄を開く）
 * - memory: 来訪者に伝えるとよいことを、にちよさんが覚えてよいか聞く
 */
export type HelpProposal =
  | { kind: "change"; answer: HelpProposalAnswer }
  | { kind: "edit"; field: HelpProposalField }
  | { kind: "memory"; note: HelpMemoryNote };

const FIELD_IDS = [
  "hours",
  "payment",
  "rain",
  "instagram",
  "x",
  "website",
  "weekly-products",
  "shop-name",
  "strength",
] as const satisfies readonly HelpProposalField[];

/** にちよさんが覚えることの案。トピックタイトル + 本文（にちよさんのノートと同じ形） */
export type HelpMemoryNote = { title: string; content: string };

/** 覚えることの案の長さ。ノートの上限より短くして、要点だけにさせる */
const MEMORY_TITLE_MAX = 30;
const MEMORY_CONTENT_MAX = 300;

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
  {
    type: "function",
    function: {
      name: "open_field",
      description:
        "出店者が項目を変えたいと言ったが、新しい値がまだ分からないときに呼ぶ。いまの値を入れた入力欄を開き、出店者がその場で入れる。聞き返さずにこちらを使う",
      parameters: {
        type: "object",
        properties: {
          field: {
            type: "string",
            enum: FIELD_IDS,
            description:
              "hours=営業時間、payment=支払い方法、rain=雨の日の出店、instagram、x、website=webサイト、weekly-products=今週出す商品、shop-name=店名、strength=お店のこだわり",
          },
        },
        required: ["field"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_memory",
      description:
        "出店者が話した、来訪者に伝えるとよいお店のこと（混む時間・おすすめの食べ方・取り置きの可否など）を、にちよさんが覚えてよいか聞く",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: `何の話か（例: 混む時間、お支払い方法）。${MEMORY_TITLE_MAX}文字以内` },
          content: { type: "string", description: `覚えること。出店者が話したことだけを、来訪者に伝わる形で。${MEMORY_CONTENT_MAX}文字以内` },
        },
        required: ["title", "content"],
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

const normalize = (value: string) => value.normalize("NFKC").toLowerCase();

/**
 * 自由に書ける値（リンク・店名）は、出店者がいま書いた言葉に入っているときだけ案にする。
 * AI に渡すデータには来訪者やほかの出店者が入れた言葉（よく検索された言葉など）も入るため、
 * そこに紛れた指示で、偽のサイトの URL などを案に出させないようにする
 */
function saidByVendor(answer: HelpProposalAnswer, userText: string): boolean {
  const said = normalize(userText);
  switch (answer.id) {
    case "website":
      return said.includes(normalize(answer.value.replace(/^https?:\/\//i, "").replace(/\/$/, "")));
    case "instagram":
    case "x":
      return said.includes(normalize(answer.value));
    case "shop-name":
      return said.includes(normalize(answer.text));
    default:
      return true;
  }
}

const OpenFieldSchema = z.object({ field: z.enum(FIELD_IDS) });

const MemoryNoteSchema = z.object({
  title: trimmed(MEMORY_TITLE_MAX).min(1),
  content: trimmed(MEMORY_CONTENT_MAX).min(1),
});

/** 連絡先やリンクに見える文字（URL・ドメイン・メール・@ID・電話番号） */
const CONTACT_LIKE =
  /https?:\/\/\S+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|@[\w.]{2,}|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}|\d[\d\-()（）\s]{6,}\d/giu;

/** 覚えることにリンクや連絡先が入っているか。確認カードで、合っているか確かめるよう添える */
export function memoryHasContact(note: HelpMemoryNote): boolean {
  return [...normalize(`${note.title}\n${note.content}`).matchAll(CONTACT_LIKE)].length > 0;
}

const squash = (value: string) => normalize(value).replace(/[\s\-()（）]/g, "");

/**
 * 覚える案が、出店者が自分で話したことに基づいているか。
 *
 * AI に渡すデータには、来訪者やほかの出店者が入れた言葉（よく検索された言葉など）も入る。
 * そこに紛れた偽のリンクや電話番号が、覚えることに混ざって来訪者の AI に届かないよう、
 * - 連絡先やリンクに見える文字は、出店者が書いたものだけ
 * - データの言葉は、出店者も書いたときだけ
 * 案にする。言い回しは AI が来訪者向けに直すので、文全体の一致までは求めない
 */
function memoryGroundedIn(
  note: HelpMemoryNote,
  vendorText: string,
  untrustedWords: readonly string[]
): boolean {
  const said = normalize(vendorText);
  const saidSquashed = squash(vendorText);
  const body = normalize(`${note.title}\n${note.content}`);
  for (const match of body.matchAll(CONTACT_LIKE)) {
    if (!saidSquashed.includes(squash(match[0].replace(/^https?:\/\//, "")))) return false;
  }
  return untrustedWords.every((raw) => {
    const word = normalize(raw.trim());
    return word.length < 2 || !body.includes(word) || said.includes(word);
  });
}

/**
 * AI が呼んだ関数を案にする。知らない関数・壊れた引数・範囲外の値は null。
 * 複数呼ばれたときは、最初に読めたものだけを使う（確認は1つずつ）。
 * userText は出店者がいま書いた質問（saidByVendor）。覚える案の確かめには、
 * これまでの出店者の発言（vendorText）と、データの言葉（untrustedWords）も使う（memoryGroundedIn）
 */
export function proposalFromToolCalls(
  calls: { name: string; arguments: string }[],
  userText: string,
  { vendorText = userText, untrustedWords = [] }: { vendorText?: string; untrustedWords?: readonly string[] } = {}
): HelpProposal | null {
  for (const call of calls) {
    let args: unknown;
    try {
      args = JSON.parse(call.arguments || "{}");
    } catch {
      continue;
    }
    if (call.name === "propose_memory") {
      const parsed = MemoryNoteSchema.safeParse(args);
      if (parsed.success && memoryGroundedIn(parsed.data, vendorText, untrustedWords)) {
        return { kind: "memory", note: parsed.data };
      }
      continue;
    }
    if (call.name === "open_field") {
      const parsed = OpenFieldSchema.safeParse(args);
      if (parsed.success) return { kind: "edit", field: parsed.data.field };
      continue;
    }
    const toAnswer = Object.hasOwn(TOOL_SCHEMAS, call.name) ? TOOL_SCHEMAS[call.name] : undefined;
    if (!toAnswer) continue;
    const answer = toAnswer(args);
    if (answer && saidByVendor(answer, userText)) return { kind: "change", answer };
  }
  return null;
}

/** 答えの最後に付ける案のデータ */
export function serializeProposal(proposal: HelpProposal): string {
  return JSON.stringify({ type: "proposal", ...proposal });
}

const ChangeAnswerSchema = z.discriminatedUnion("id", [
  z.object({ id: z.literal("hours"), start: z.enum(TIME_OPTIONS as [string, ...string[]]), end: z.enum(TIME_OPTIONS as [string, ...string[]]) }),
  z.object({ id: z.literal("payment"), methods: z.array(z.enum(PAYMENT_KEYS)), note: z.string().max(NOTE_MAX) }),
  z.object({ id: z.literal("rain"), policy: z.enum(RAIN_KEYS), note: z.string().max(NOTE_MAX) }),
  z.object({ id: z.literal("instagram"), value: z.string().max(LINK_MAX) }),
  z.object({ id: z.literal("x"), value: z.string().max(LINK_MAX) }),
  z.object({ id: z.literal("website"), value: z.string().max(LINK_MAX) }),
  z.object({ id: z.literal("weekly-products"), products: z.array(z.string().max(PRODUCT_NAME_MAX)).max(PRODUCTS_MAX) }),
  z.object({ id: z.literal("shop-name"), text: z.string().max(SHOP_NAME_MAX) }),
  z.object({ id: z.literal("strength"), text: z.string().max(STRENGTH_MAX) }),
]);

const ProposalFrameSchema = z.discriminatedUnion("kind", [
  z.object({ type: z.literal("proposal"), kind: z.literal("change"), answer: ChangeAnswerSchema }),
  z.object({ type: z.literal("proposal"), kind: z.literal("edit"), field: z.enum(FIELD_IDS) }),
  z.object({ type: z.literal("proposal"), kind: z.literal("memory"), note: MemoryNoteSchema }),
]);

/** 画面側で、答えの最後に付いた案のデータを読む。読めなければ null */
export function parseProposalFrame(raw: string): HelpProposal | null {
  try {
    const parsed = ProposalFrameSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return parsed.data.kind === "change"
      ? { kind: "change", answer: parsed.data.answer as HelpProposalAnswer }
      : parsed.data.kind === "edit"
        ? { kind: "edit", field: parsed.data.field }
        : { kind: "memory", note: parsed.data.note };
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
