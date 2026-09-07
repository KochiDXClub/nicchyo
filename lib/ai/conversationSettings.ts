/**
 * 相談の会話設定（発話数・返答の長さ・履歴件数）
 *
 * 「コードに既定値、DBで上書き」の構造は lib/grandma/prompts/promptKeys.ts と同じ。
 * DBの正本は supabase/migrations/20260907160000_create_ai_conversation_settings.sql で、
 * ここの定義とのズレは conversationSettings.test.ts が止める。
 *
 * ここに載せてよいのは **運営調整可** の値だけ。
 * 行フォーマットやJSONスキーマの形（`buildStreamingFormatPrompt()` /
 * `buildResponseSchema()` が決めている部分）は、変えるとパーサや描画と対に
 * ならなくなるので載せない。詳細は lib/grandma/prompts/README.md を見る。
 *
 * 管理画面の入力欄は AI_CONVERSATION_SETTING_DEFS から自動生成する。
 */
import { CONSULT_MAX_TURNS } from "@/lib/grandma/prompts/consultConversation";

export type AiConversationSettingKey =
  | "consult.max_turns"
  | "consult.max_output_tokens"
  | "consult.history_limit";

export type AiConversationSettingDef = {
  key: AiConversationSettingKey;
  /** 管理画面の見出し */
  label: string;
  /** 管理画面の説明文。運営が何を決める値なのか分かる言葉にする */
  description: string;
  /** DBが読めない・値が壊れているときに使う既定値 */
  defaultValue: number;
  /**
   * 受け付ける範囲。
   *
   * 値を間違えたときの被害がキーごとに違うので、キーごとに決める。
   * DBの CHECK 制約（マイグレーション）と必ず同じ値にすること。
   */
  minValue: number;
  maxValue: number;
};

export const AI_CONVERSATION_SETTING_DEFS: readonly AiConversationSettingDef[] = [
  {
    key: "consult.max_turns",
    label: "1回の返答の発話数",
    description:
      "1回の返答で出す吹き出しの数の上限。2以上にすると1秒ずつ間をあけて順に出るため、同じキャラでも掛け合いのように見える。",
    // コード側の既定値はプロンプト組み立て側と1箇所にまとめる
    defaultValue: CONSULT_MAX_TURNS,
    minValue: 1,
    maxValue: 3,
  },
  {
    key: "consult.max_output_tokens",
    label: "返答の長さ（最大トークン数）",
    description:
      "AIが1回に生成できる長さの上限。短すぎると文の途中で切れ、長すぎると読まれずに流される。目安は300〜700。",
    defaultValue: 500,
    minValue: 200,
    maxValue: 1200,
  },
  {
    key: "consult.history_limit",
    label: "AIに渡す直近の会話の件数",
    description:
      "「さっきの話」をどこまで覚えているか。多いほど文脈は続くが、古いやり取りの言い回しを真似しやすくなる。",
    defaultValue: 6,
    minValue: 0,
    maxValue: 12,
  },
];

export const AI_CONVERSATION_SETTING_DEF_BY_KEY = new Map<
  AiConversationSettingKey,
  AiConversationSettingDef
>(AI_CONVERSATION_SETTING_DEFS.map((def) => [def.key, def]));

export const AI_CONVERSATION_SETTING_KEYS: readonly AiConversationSettingKey[] =
  AI_CONVERSATION_SETTING_DEFS.map((def) => def.key);

export type AiConversationSettings = Record<AiConversationSettingKey, number>;

/** DBが読めないときに使うコード側の既定値一式 */
export const DEFAULT_AI_CONVERSATION_SETTINGS: AiConversationSettings = Object.fromEntries(
  AI_CONVERSATION_SETTING_DEFS.map((def) => [def.key, def.defaultValue])
) as AiConversationSettings;

export function isAiConversationSettingKey(value: unknown): value is AiConversationSettingKey {
  return (
    typeof value === "string" &&
    AI_CONVERSATION_SETTING_DEF_BY_KEY.has(value as AiConversationSettingKey)
  );
}

export type AiConversationSettingValidationError =
  | "unknown_key"
  | "not_integer"
  | "out_of_range";

export type AiConversationSettingValidationResult =
  | { ok: true; key: AiConversationSettingKey; value: number }
  | { ok: false; reason: AiConversationSettingValidationError };

/**
 * 1件の入力を検証する。
 *
 * **読み取り側（normalizeAiConversationSettings）と書き込み側（管理API）の
 * 両方から呼ぶこと。** 別々の判定にすると、範囲外の値を「保存しました」と
 * 受け取ったのに読み取り側が既定値に落とす、という無言の食い違いが起きる。
 */
export function validateAiConversationSettingValue(
  key: unknown,
  value: unknown
): AiConversationSettingValidationResult {
  if (!isAiConversationSettingKey(key)) return { ok: false, reason: "unknown_key" };
  const def = AI_CONVERSATION_SETTING_DEF_BY_KEY.get(key);
  if (!def) return { ok: false, reason: "unknown_key" };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, reason: "not_integer" };
  }
  if (value < def.minValue || value > def.maxValue) {
    return { ok: false, reason: "out_of_range" };
  }
  return { ok: true, key, value };
}

/**
 * DBから読んだ行を、欠けているキーを既定値で埋めた完全な組に正規化する。
 *
 * 検証を通らなかった値はすべて既定値に落とす。
 * 設定が壊れていてもAIが動き続けることを優先する。
 */
export function normalizeAiConversationSettings(rows: unknown): AiConversationSettings {
  const result: AiConversationSettings = { ...DEFAULT_AI_CONVERSATION_SETTINGS };
  if (!Array.isArray(rows)) return result;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { key, value } = row as { key?: unknown; value?: unknown };
    const validated = validateAiConversationSettingValue(key, value);
    if (!validated.ok) continue;
    result[validated.key] = validated.value;
  }

  return result;
}
