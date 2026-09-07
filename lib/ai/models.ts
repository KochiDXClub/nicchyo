/**
 * AIモデルの定義と、呼び出しごとのモデル選択
 *
 * 「コードに既定値、DBで上書き」の構造は lib/mapFeatureFlags.ts、
 * lib/grandma/prompts/promptKeys.ts と同じ。
 * 管理画面の選択肢は AI_MODEL_DEFS / AI_USE_CASE_DEFS から自動生成する。
 *
 * ここが担う一番大事な仕事は **モデルごとのAPIパラメータの違いを吸収すること**。
 * 運営が管理画面から自由にモデルを切り替えられるようにする以上、
 * 選んだモデルに合わないパラメータを送って本番が黙って壊れる、という形の
 * 事故を仕組みで防ぐ必要がある。違いは3つある。
 *
 *   1. 出力上限のパラメータ名が `max_tokens` と `max_completion_tokens` で違う
 *   2. 推論モデルは**推論トークンも出力上限を食う**。
 *      既存の上限（shop-chat は 280）のまま推論モデルに切り替えると、
 *      推論だけで枠を使い切って本文が空で返る
 *   3. temperature を受け付けないモデルがある
 *
 * 呼び出し側は buildChatCompletionBody() を通すこと。fetch に直接
 * リクエストボディを書くと、この吸収が効かない。
 */

/** モデルを使う場面。場面ごとに別のモデルを割り当てられる */
export type AiUseCase = "consult" | "shopChat" | "itinerary" | "mapAgent";

/**
 * 推論の深さ。
 * 受け付ける値はモデルごとに違うので、各定義の reasoningEfforts で持つ。
 */
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type AiModelDef = {
  /** OpenAI API に渡す model 名 */
  id: string;
  /** 管理画面の表示名 */
  label: string;
  /** 管理画面の説明。運営が「どれを選べばいいか」を判断できる言葉にする */
  description: string;
  /** 出力上限のパラメータ名 */
  tokenParam: "max_tokens" | "max_completion_tokens";
  /**
   * temperature を送ってよいか。
   * false のモデルには送らない。送って 400 で落ちるより、送らずに
   * モデル既定値で動く方が被害が小さい
   */
  supportsTemperature: boolean;
  /**
   * 受け付ける reasoning_effort。空配列なら推論モデルではない。
   * 先頭が既定値
   */
  reasoningEfforts: readonly ReasoningEffort[];
  /**
   * 推論を有効にしたときに、出力上限へ上乗せするトークン数。
   * 推論トークンが本文の枠を食い潰さないようにするための余白
   */
  reasoningHeadroomTokens: number;
  /** 参考価格（$ / 1M token）。管理画面に出して運営が判断できるようにする */
  pricing: { input: number; output: number };
};

/**
 * 選べるモデルの許可リスト。
 *
 * **ここに載っていないモデルは選べない。** 管理画面からの入力をそのまま
 * OpenAI に渡すと、存在しないモデル名で全リクエストが落ちる形の事故になる。
 *
 * 価格は 2026-09 時点。比較の経緯は docs/MODEL_COMPARISON_2026-07.md を参照。
 */
export const AI_MODEL_DEFS: readonly AiModelDef[] = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini（現行）",
    description:
      "長く使ってきた既定のモデル。速度・安定性ともに実績がある。ChatGPT と Azure では提供が終了しており、APIもいずれ終わる見込み。",
    tokenParam: "max_tokens",
    supportsTemperature: true,
    reasoningEfforts: [],
    reasoningHeadroomTokens: 0,
    pricing: { input: 0.15, output: 0.6 },
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano（推奨）",
    description:
      "会話向けの軽量モデル。2026-07 の比較で最速だった。相談・店舗チャット・意図抽出のような、速さが体験を決める場面向け。",
    tokenParam: "max_completion_tokens",
    // 未検証。送って 400 になるより、送らずにモデル既定値で動く方を選ぶ
    supportsTemperature: false,
    reasoningEfforts: ["minimal", "low", "medium", "high"],
    reasoningHeadroomTokens: 4000,
    pricing: { input: 0.2, output: 1.25 },
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description:
      "nano より賢いが約4倍高く、体感で2倍遅い。回り方プランのように、実際に順序を考える必要がある場面向け。",
    tokenParam: "max_completion_tokens",
    supportsTemperature: false,
    reasoningEfforts: ["minimal", "low", "medium", "high"],
    reasoningHeadroomTokens: 6000,
    pricing: { input: 0.75, output: 4.5 },
  },
  {
    id: "gpt-5-nano",
    label: "GPT-5 nano（最安）",
    description:
      "候補の中で最も安い。5.4 nano より前の世代なので品質は落ちる。コストを最優先する場面向け。",
    tokenParam: "max_completion_tokens",
    supportsTemperature: false,
    reasoningEfforts: ["minimal", "low", "medium", "high"],
    reasoningHeadroomTokens: 4000,
    pricing: { input: 0.05, output: 0.4 },
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    description:
      "5.6 世代の軽量モデル。価格は 5.4 nano とほぼ同じ。推論を切れば速いが、既定のままだと考えてから答えるぶん待ちが伸びる。",
    tokenParam: "max_completion_tokens",
    supportsTemperature: true,
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
    reasoningHeadroomTokens: 6000,
    pricing: { input: 0.2, output: 1.2 },
  },
];

export const AI_MODEL_DEF_BY_ID = new Map<string, AiModelDef>(
  AI_MODEL_DEFS.map((def) => [def.id, def])
);

export const AI_MODEL_IDS: readonly string[] = AI_MODEL_DEFS.map((def) => def.id);

export type AiUseCaseDef = {
  useCase: AiUseCase;
  /** 管理画面の見出し */
  label: string;
  /** 管理画面の説明。どの画面のどの機能かが運営に分かる言葉にする */
  description: string;
  /** コード側の既定モデル。DBが読めない・空のときはこれを使う */
  defaultModelId: string;
};

export const AI_USE_CASE_DEFS: readonly AiUseCaseDef[] = [
  {
    useCase: "consult",
    label: "AI相談（にちよさん）",
    description:
      "相談ページとマップのミニチャット。土佐弁の会話を1文字ずつ流しながら返すので、待ち時間がそのまま体験に出る。",
    defaultModelId: "gpt-4o-mini",
  },
  {
    useCase: "shopChat",
    label: "店舗ページのチャット",
    description: "店舗詳細ページの短い質問応答。280文字程度の短い返事を速く返す。",
    defaultModelId: "gpt-4o-mini",
  },
  {
    useCase: "itinerary",
    label: "回り方プラン",
    description:
      "時間と興味から順路を組み立てる。実際に順序を考える処理なので、ここだけは賢いモデルが効く可能性がある。",
    defaultModelId: "gpt-4o-mini",
  },
  {
    useCase: "mapAgent",
    label: "マップAIアシスタント",
    description: "質問から意図を読み取ってJSONで返す。分類・抽出に近い処理。",
    defaultModelId: "gpt-4o-mini",
  },
];

export const AI_USE_CASE_DEF_BY_KEY = new Map<AiUseCase, AiUseCaseDef>(
  AI_USE_CASE_DEFS.map((def) => [def.useCase, def])
);

export const AI_USE_CASES: readonly AiUseCase[] = AI_USE_CASE_DEFS.map((def) => def.useCase);

/** 場面ごとに選んだモデルと推論の深さ */
export type AiModelChoice = {
  modelId: string;
  /** 未指定ならモデルの既定値（reasoningEfforts の先頭） */
  reasoningEffort?: ReasoningEffort;
};

export type AiModelSettingSet = Record<AiUseCase, AiModelChoice>;

/** DBが読めない・空のときに使うコード側の既定値一式 */
export const DEFAULT_AI_MODEL_SETTINGS: AiModelSettingSet = Object.fromEntries(
  AI_USE_CASE_DEFS.map((def) => [def.useCase, { modelId: def.defaultModelId }])
) as AiModelSettingSet;

export function isAiUseCase(value: unknown): value is AiUseCase {
  return typeof value === "string" && AI_USE_CASE_DEF_BY_KEY.has(value as AiUseCase);
}

export function isAiModelId(value: unknown): value is string {
  return typeof value === "string" && AI_MODEL_DEF_BY_ID.has(value);
}

export type AiModelValidationError =
  | "unknown_use_case"
  | "unknown_model"
  | "unsupported_reasoning_effort";

export type AiModelValidationResult =
  | { ok: true; useCase: AiUseCase; choice: AiModelChoice }
  | { ok: false; reason: AiModelValidationError };

/**
 * 1件の選択を検証する。
 *
 * **読み取り側（normalizeAiModelSettings）と書き込み側（管理API）の両方から呼ぶこと。**
 * 別々の判定にすると、受け付けられない組み合わせを「保存しました」と返したのに
 * 読み取り側が既定値へ落とす、という無言の食い違いが起きる
 * （validateAiPromptBody と同じ方針）。
 */
export function validateAiModelChoice(
  useCase: unknown,
  modelId: unknown,
  reasoningEffort?: unknown
): AiModelValidationResult {
  if (!isAiUseCase(useCase)) return { ok: false, reason: "unknown_use_case" };
  if (!isAiModelId(modelId)) return { ok: false, reason: "unknown_model" };

  const model = AI_MODEL_DEF_BY_ID.get(modelId);
  if (!model) return { ok: false, reason: "unknown_model" };

  if (reasoningEffort === undefined || reasoningEffort === null || reasoningEffort === "") {
    return { ok: true, useCase, choice: { modelId } };
  }
  // 推論を受け付けないモデルに深さを指定させない。
  // 保存できてしまうと、モデルを戻したときに効かない設定が残り続ける
  if (!model.reasoningEfforts.includes(reasoningEffort as ReasoningEffort)) {
    return { ok: false, reason: "unsupported_reasoning_effort" };
  }

  return {
    ok: true,
    useCase,
    choice: { modelId, reasoningEffort: reasoningEffort as ReasoningEffort },
  };
}

/**
 * DBから読んだ行を、欠けている場面を既定値で埋めた完全な組に正規化する。
 *
 * 検証を通らなかった値はすべて既定値に落とす。設定が壊れていても
 * AIが動き続けることを優先する（normalizeAiPrompts と同じ方針）。
 */
export function normalizeAiModelSettings(rows: unknown): AiModelSettingSet {
  const result: AiModelSettingSet = { ...DEFAULT_AI_MODEL_SETTINGS };
  if (!Array.isArray(rows)) return result;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { use_case: useCase, model_id: modelId, reasoning_effort: effort } = row as {
      use_case?: unknown;
      model_id?: unknown;
      reasoning_effort?: unknown;
    };
    const validated = validateAiModelChoice(useCase, modelId, effort);
    if (!validated.ok) continue;
    result[validated.useCase] = validated.choice;
  }

  return result;
}

/** 実際に使うモデルと推論の深さ。choice を定義と突き合わせて解決したもの */
export type ResolvedAiModel = {
  def: AiModelDef;
  reasoningEffort?: ReasoningEffort;
};

export function resolveAiModelChoice(choice: AiModelChoice, useCase: AiUseCase): ResolvedAiModel {
  const def =
    AI_MODEL_DEF_BY_ID.get(choice.modelId) ??
    AI_MODEL_DEF_BY_ID.get(DEFAULT_AI_MODEL_SETTINGS[useCase].modelId);
  // 既定値のIDが許可リストに無い、は定義の書き間違いなのでテストで落とす
  if (!def) throw new Error(`AIモデルの既定値が AI_MODEL_DEFS にありません: ${useCase}`);

  const effort =
    choice.reasoningEffort && def.reasoningEfforts.includes(choice.reasoningEffort)
      ? choice.reasoningEffort
      : def.reasoningEfforts[0];

  return effort ? { def, reasoningEffort: effort } : { def };
}

/** 推論トークンが出力上限を食う状態か */
function usesThinkingTokens(effort: ReasoningEffort | undefined): boolean {
  return effort !== undefined && effort !== "none" && effort !== "minimal";
}

/**
 * 出力上限を解決する。
 *
 * 呼び出し側が指定するのは「本文に使ってほしいトークン数」。
 * 推論モデルではそこに推論ぶんの余白を足す。**足さないと本文が空で返る。**
 */
export function resolveMaxOutputTokens(model: ResolvedAiModel, visibleTokens: number): number {
  if (!usesThinkingTokens(model.reasoningEffort)) return visibleTokens;
  return visibleTokens + model.def.reasoningHeadroomTokens;
}

export type ChatCompletionParams = {
  messages: unknown[];
  /**
   * 本文に使ってほしいトークン数。推論ぶんの余白は自動で足される。
   * 省略すると上限を送らない（モデル既定にまかせる）
   */
  maxOutputTokens?: number;
  temperature?: number;
  stream?: boolean;
  responseFormat?: unknown;
};

/**
 * Chat Completions のリクエストボディを組み立てる。
 *
 * モデルごとのパラメータの差はここで吸収する。呼び出し側が
 * `model` や `max_tokens` を直接書かないこと。
 */
export function buildChatCompletionBody(
  model: ResolvedAiModel,
  params: ChatCompletionParams
): Record<string, unknown> {
  const { def, reasoningEffort } = model;

  const body: Record<string, unknown> = {
    model: def.id,
    messages: params.messages,
  };

  if (params.maxOutputTokens !== undefined) {
    body[def.tokenParam] = resolveMaxOutputTokens(model, params.maxOutputTokens);
  }

  if (params.temperature !== undefined && def.supportsTemperature) {
    body.temperature = params.temperature;
  }
  if (reasoningEffort) {
    body.reasoning_effort = reasoningEffort;
  }
  if (params.stream) {
    body.stream = true;
  }
  if (params.responseFormat !== undefined) {
    body.response_format = params.responseFormat;
  }

  return body;
}
