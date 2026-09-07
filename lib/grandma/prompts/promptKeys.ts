/**
 * DBで上書きできるプロンプトの定義
 *
 * 「コードに既定値、DBで上書き」の構造は lib/mapFeatureFlags.ts と同じ。
 * 既定値はこのファイルではなく各プロンプトモジュールから引いてくるので、
 * コード側の文面とここが二重管理になることはない。
 *
 * ここに載せてよいのは **運営調整可** の文面だけ。
 * 出力ルール（CONSULT_OUTPUT_RULES）とストリーミング形式の指示は
 * JSONスキーマ・パーサ・描画と対になっていて、1行消すと相談機能が止まる。
 * 詳細は同ディレクトリの README.md を見る。
 *
 * 管理画面の入力欄は AI_PROMPT_DEFS から自動生成する
 * （MAP_FEATURE_FLAG_DEFS が設定画面のスイッチを生成しているのと同じやり方）。
 */
import type { ConsultCharacterId } from "@/app/(public)/consult/data/consultCharacters";
import { CONSULT_CHARACTER_PROMPT_PROFILES } from "./consultCharacterProfiles";
import { CONSULT_CONTENT_RULES, CONSULT_CONVERSATION_RULES } from "./consultSystemPrompt";

export const AI_PROMPT_CHARACTER_IDS: readonly ConsultCharacterId[] = [
  "nichiyosan",
  "yoichisan",
  "miraikun",
  "yosakochan",
];

/** 表示名。管理画面のラベルに使う */
const CHARACTER_LABELS: Record<ConsultCharacterId, string> = {
  nichiyosan: "にちよさん",
  yoichisan: "よういちさん",
  miraikun: "みらいくん",
  yosakochan: "よさこちゃん",
};

export type AiPromptKey =
  | "consult.conversation_rules"
  | "consult.content_rules"
  | "consult.operator_note"
  | `consult.character.${ConsultCharacterId}.personality`
  | `consult.character.${ConsultCharacterId}.speech_style`;

export type AiPromptDef = {
  key: AiPromptKey;
  /** 管理画面の見出し */
  label: string;
  /** 管理画面の説明文。運営が何を書けばいいか分かる言葉にする */
  description: string;
  /** 管理画面のセクション分け */
  group: "rules" | "characters" | "weekly";
  /** コード側の既定値。DBが空・読めないときはこれを使う */
  defaultBody: string;
  /** 入力の上限。DBの値がそのまま system prompt に入るので必ず制限する */
  maxLength: number;
  /** 複数行の入力欄にするか */
  multiline: boolean;
};

function characterDefs(): AiPromptDef[] {
  return AI_PROMPT_CHARACTER_IDS.flatMap((id): AiPromptDef[] => [
    {
      key: `consult.character.${id}.personality`,
      label: `${CHARACTER_LABELS[id]}：性格`,
      description: "どんな態度で話すか。「やさしく場をつなぐ」「しみじみ語る」など。",
      group: "characters",
      defaultBody: CONSULT_CHARACTER_PROMPT_PROFILES[id].personality,
      maxLength: 200,
      multiline: false,
    },
    {
      key: `consult.character.${id}.speech_style`,
      label: `${CHARACTER_LABELS[id]}：話し方`,
      description: "「土佐弁」「標準語」など、言葉づかいの指定。",
      group: "characters",
      defaultBody: CONSULT_CHARACTER_PROMPT_PROFILES[id].speechStyle,
      maxLength: 60,
      multiline: false,
    },
  ]);
}

export const AI_PROMPT_DEFS: readonly AiPromptDef[] = [
  {
    key: "consult.conversation_rules",
    label: "会話ルール",
    description:
      "掛け合いの作り方。発話数、1発話の長さ、方言の濃さ、言い換えを繰り返さないことなど。",
    group: "rules",
    defaultBody: CONSULT_CONVERSATION_RULES,
    maxLength: 2000,
    multiline: true,
  },
  {
    key: "consult.content_rules",
    label: "内容ルール",
    description:
      "何をどう答えるか。断り方、季節や旬を優先すること、店舗DBにない一般知識の扱いなど。",
    group: "rules",
    defaultBody: CONSULT_CONTENT_RULES,
    maxLength: 2000,
    multiline: true,
  },
  {
    key: "consult.operator_note",
    label: "今週のメモ",
    description:
      "その週だけAIに教えたいこと。「今週は雨天中止の店が多い」「◯◯は今週お休み」など。空でよい。",
    group: "weekly",
    defaultBody: "",
    maxLength: 600,
    multiline: true,
  },
  ...characterDefs(),
];

export const AI_PROMPT_DEF_BY_KEY = new Map<AiPromptKey, AiPromptDef>(
  AI_PROMPT_DEFS.map((def) => [def.key, def])
);

export const AI_PROMPT_KEYS: readonly AiPromptKey[] = AI_PROMPT_DEFS.map((def) => def.key);

/** DBが読めない・空のときに使うコード側の既定値一式 */
export const DEFAULT_AI_PROMPTS: AiPromptSet = Object.fromEntries(
  AI_PROMPT_DEFS.map((def) => [def.key, def.defaultBody])
) as AiPromptSet;

export type AiPromptSet = Record<AiPromptKey, string>;

export function isAiPromptKey(value: unknown): value is AiPromptKey {
  return typeof value === "string" && AI_PROMPT_DEF_BY_KEY.has(value as AiPromptKey);
}

export type AiPromptValidationError =
  | "unknown_key"
  | "not_string"
  | "empty"
  | "too_long"
  | "newline_not_allowed"
  | "control_character";

/**
 * 改行・タブ以外の制御文字。
 * NUL は Postgres の insert がエラーになるし、system prompt に入れる意味もない
 */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export type AiPromptValidationResult =
  | { ok: true; key: AiPromptKey; value: string }
  | { ok: false; reason: AiPromptValidationError };

/**
 * 1件の入力を検証する。
 *
 * **読み取り側（normalizeAiPrompts）と書き込み側（管理API）の両方から呼ぶこと。**
 * 別々の判定にすると、上限を超える文章を「保存しました」と受け取ったのに
 * 読み取り側が既定値に落とす、という無言の食い違いが起きる。
 */
export function validateAiPromptBody(key: unknown, body: unknown): AiPromptValidationResult {
  if (!isAiPromptKey(key)) return { ok: false, reason: "unknown_key" };
  const def = AI_PROMPT_DEF_BY_KEY.get(key);
  if (!def) return { ok: false, reason: "unknown_key" };
  if (typeof body !== "string") return { ok: false, reason: "not_string" };

  const trimmed = body.trim();
  // 既定値が空のキー（今週のメモ）は、空で保存できないと運営がメモを消せなくなる
  if (!trimmed && def.defaultBody !== "") return { ok: false, reason: "empty" };
  if (trimmed.length > def.maxLength) return { ok: false, reason: "too_long" };
  if (CONTROL_CHARACTERS.test(trimmed)) return { ok: false, reason: "control_character" };
  // multiline: false は入力欄の見た目だけの話ではない。
  // 1行前提の値（キャラの性格・話し方）は `  personality: ...` の形で
  // プロンプトの1行に埋め込まれるので、改行が入るとキャスト定義の行構造が壊れ、
  // 後続の行が別のフィールドや別の指示として読める
  if (!def.multiline && /[\r\n]/.test(trimmed)) {
    return { ok: false, reason: "newline_not_allowed" };
  }

  return { ok: true, key, value: trimmed };
}

/**
 * DBから読んだ行を、欠けているキーを既定値で埋めた完全な組に正規化する。
 *
 * validateAiPromptBody を通らなかった値はすべて既定値に落とす。
 * DBが壊れていてもAIが動き続けることを優先する。
 */
export function normalizeAiPrompts(rows: unknown): AiPromptSet {
  const result: AiPromptSet = { ...DEFAULT_AI_PROMPTS };
  if (!Array.isArray(rows)) return result;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { key, body } = row as { key?: unknown; body?: unknown };
    const validated = validateAiPromptBody(key, body);
    if (!validated.ok) continue;
    result[validated.key] = validated.value;
  }

  return result;
}
