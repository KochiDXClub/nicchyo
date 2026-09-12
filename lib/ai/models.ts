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
    // 2026-09-12 に temperature 0.7 で 200 を確認
    supportsTemperature: true,
    // 5.4 系は `minimal` を受け付けない（400 unsupported_value。2026-09-12 に実測）。
    // 受け付けるのは none / low / medium / high / xhigh
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
    reasoningHeadroomTokens: 4000,
    pricing: { input: 0.2, output: 1.25 },
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    description:
      "nano より賢いが約4倍高く、体感で2倍遅い。回り方プランのように、実際に順序を考える必要がある場面向け。",
    tokenParam: "max_completion_tokens",
    // 2026-09-12 に temperature 0.7 で 200 を確認
    supportsTemperature: true,
    // nano と同じく `minimal` は 400。none / low / medium / high / xhigh
    reasoningEfforts: ["none", "low", "medium", "high", "xhigh"],
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

// ─── 台帳（DB の ai_models / ai_use_cases）───────────────────────────────

/**
 * 選べるモデルと、AIを使っている機能の一覧。
 *
 * 実体は DB の ai_models / ai_use_cases。**モデルはDBに行を足すだけで増やせる**
 * （能力の列も行が持っているため）。DBが読めないときは下の CODE_AI_CATALOG に落ちる。
 *
 * 一方で **機能はDBに行を足しても増えない。** 実際にモデルを使うのはコード側の
 * 呼び出し（resolveAiModelFor("consult") など）で、AI_USE_CASES に無いキーの行は
 * どこからも参照されない。行はコードが持つ機能に対応する台帳という位置づけ。
 */
export type AiCatalog = {
  models: readonly AiModelDef[];
  useCases: readonly AiUseCaseDef[];
};

/** DBが読めないときに使うコード側の台帳 */
export const CODE_AI_CATALOG: AiCatalog = {
  models: AI_MODEL_DEFS,
  useCases: AI_USE_CASE_DEFS,
};

/**
 * DBの CHECK 制約（ai_models_reasoning_efforts_valid）と同じ語彙。
 * ここを増やすときはマイグレーションも要る（models.test.ts が突き合わせる）
 */
export const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === "string" && REASONING_EFFORTS.includes(value as ReasoningEffort);
}

export function findAiModel(catalog: AiCatalog, modelId: unknown): AiModelDef | undefined {
  if (typeof modelId !== "string") return undefined;
  return catalog.models.find((model) => model.id === modelId);
}

export function isAiModelId(catalog: AiCatalog, value: unknown): value is string {
  return findAiModel(catalog, value) !== undefined;
}

/**
 * 推論の余白の上限。これを超える値は台帳の書き間違いとみなす。
 * DBの CHECK 制約（ai_models_headroom_bounded）と同値
 */
export const MAX_REASONING_HEADROOM_TOKENS = 32000;

/**
 * ai_models の1行を定義に変換する。
 *
 * **1列ずつ正しくても、組み合わせが壊れていれば捨てる。**
 * 壊れた能力でリクエストを組むと、その機能の全リクエストが落ち続ける
 * （あるいは本文が空のまま 200 で返り続ける）。コード側の定義に落ちて
 * 動き続けるほうが被害が小さい。
 *
 * なお **同じIDの行が汚染された場合、コード側の定義はフォールバックにならない**
 * （findAiModel が台帳の行を先に引くため）。だからここで内部矛盾を弾く必要がある。
 * DB側にも同じ不変条件を CHECK 制約として置いてある。
 */
export function parseAiModelRow(row: unknown): AiModelDef | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id.trim() : "";
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!id || !label) return null;

  // 提供終了は読み取り側の .eq("is_selectable", true) でも絞っているが、
  // ここでも落とす。台帳を読む経路がフィルタを1つ書き忘れるだけで復活するため
  if (r.is_selectable === false) return null;

  const tokenParam = r.token_param;
  if (tokenParam !== "max_tokens" && tokenParam !== "max_completion_tokens") return null;

  const efforts = Array.isArray(r.reasoning_efforts)
    ? r.reasoning_efforts.filter(isReasoningEffort)
    : [];

  // 推論モデルに max_tokens を送ると 400 で全リクエストが落ちる
  if (efforts.length > 0 && tokenParam !== "max_completion_tokens") return null;

  const rawHeadroom = Number(r.reasoning_headroom_tokens);
  const headroom = Number.isFinite(rawHeadroom)
    ? Math.min(Math.max(rawHeadroom, 0), MAX_REASONING_HEADROOM_TOKENS)
    : 0;

  // 実際に考えさせる深さを持つのに余白が無いと、推論だけで出力上限を使い切り、
  // エラーにならないまま本文が空で返る
  if (efforts.some(usesThinkingTokens) && headroom === 0) return null;

  const priceIn = Number(r.price_input_per_mtok);
  const priceOut = Number(r.price_output_per_mtok);

  return {
    id,
    label,
    description: typeof r.description === "string" ? r.description : "",
    tokenParam,
    // 判断できない値は「送らない」に倒す。送って 400 になるより被害が小さい
    supportsTemperature: r.supports_temperature === true,
    reasoningEfforts: efforts,
    reasoningHeadroomTokens: headroom,
    pricing: {
      input: Number.isFinite(priceIn) ? priceIn : 0,
      output: Number.isFinite(priceOut) ? priceOut : 0,
    },
  };
}

/** ai_use_cases の1行から、機能の定義といま当てているモデルを取り出す */
export function parseAiUseCaseRow(
  row: unknown
): { def: AiUseCaseDef; choice: AiModelChoice | null } | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  // コードが呼んでいない機能の行は無視する。
  // 行を足しても新しいAI機能は生まれない（呼び出し側はコードにしかない）
  if (!isAiUseCase(r.key)) return null;
  const fallback = AI_USE_CASE_DEF_BY_KEY.get(r.key);
  if (!fallback) return null;

  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : fallback.label;
  const description =
    typeof r.description === "string" && r.description.trim()
      ? r.description.trim()
      : fallback.description;

  const choice =
    typeof r.model_id === "string" && r.model_id.trim()
      ? {
          modelId: r.model_id.trim(),
          ...(isReasoningEffort(r.reasoning_effort)
            ? { reasoningEffort: r.reasoning_effort }
            : {}),
        }
      : null;

  return {
    def: { useCase: r.key, label, description, defaultModelId: fallback.defaultModelId },
    choice,
  };
}

/**
 * DBの行から台帳を組み立てる。
 * どちらか片方でも読めなければ、その側だけコード側の定義に落ちる。
 */
export function buildAiCatalog(modelRows: unknown, useCaseRows: unknown): AiCatalog {
  const models = Array.isArray(modelRows)
    ? modelRows.map(parseAiModelRow).filter((def): def is AiModelDef => def !== null)
    : [];
  const useCases = Array.isArray(useCaseRows)
    ? useCaseRows
        .map(parseAiUseCaseRow)
        .filter((parsed): parsed is { def: AiUseCaseDef; choice: AiModelChoice | null } => parsed !== null)
        .map((parsed) => parsed.def)
    : [];

  return {
    models: models.length > 0 ? models : CODE_AI_CATALOG.models,
    useCases: useCases.length > 0 ? useCases : CODE_AI_CATALOG.useCases,
  };
}

/**
 * ai_use_cases の行から、機能ごとの選択一式を組み立てる。
 * model_id が null の機能はコード側の既定値のまま。
 */
export function normalizeAiModelSettings(catalog: AiCatalog, rows: unknown): AiModelSettingSet {
  const result: AiModelSettingSet = { ...DEFAULT_AI_MODEL_SETTINGS };
  if (!Array.isArray(rows)) return result;

  for (const row of rows) {
    const parsed = parseAiUseCaseRow(row);
    if (!parsed || !parsed.choice) continue;
    const validated = validateAiModelChoice(
      catalog,
      parsed.def.useCase,
      parsed.choice.modelId,
      parsed.choice.reasoningEffort
    );
    if (!validated.ok) continue;
    result[validated.useCase] = validated.choice;
  }

  return result;
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
  catalog: AiCatalog,
  useCase: unknown,
  modelId: unknown,
  reasoningEffort?: unknown
): AiModelValidationResult {
  if (!isAiUseCase(useCase)) return { ok: false, reason: "unknown_use_case" };

  const model = findAiModel(catalog, modelId);
  // 台帳に無いモデルは通さない。管理画面からの入力をそのまま OpenAI に渡すと、
  // 存在しないモデル名で全リクエストが落ちる
  if (!model) return { ok: false, reason: "unknown_model" };

  if (reasoningEffort === undefined || reasoningEffort === null || reasoningEffort === "") {
    return { ok: true, useCase, choice: { modelId: model.id } };
  }
  // 推論を受け付けないモデルに深さを指定させない。
  // 保存できてしまうと、モデルを戻したときに効かない設定が残り続ける
  if (!isReasoningEffort(reasoningEffort) || !model.reasoningEfforts.includes(reasoningEffort)) {
    return { ok: false, reason: "unsupported_reasoning_effort" };
  }

  return {
    ok: true,
    useCase,
    choice: { modelId: model.id, reasoningEffort },
  };
}

/** 実際に使うモデルと推論の深さ。choice を定義と突き合わせて解決したもの */
export type ResolvedAiModel = {
  def: AiModelDef;
  reasoningEffort?: ReasoningEffort;
  /**
   * 選んだモデルを OpenAI 側が受け付けなかったとき（`model_not_found`）に
   * 代わりに使うコード側の既定モデル。既定モデルそのものを選んでいるときは無い。
   *
   * 台帳に載っていても、APIキーの属する OpenAI プロジェクトで使用許可が
   * 出ていないモデルは 400 で落ちる。管理画面で切り替えた瞬間に来訪者向けの
   * 相談が全部止まるより、既定モデルで答え続けるほうが被害が小さい。
   * 実際に落ちた事実は requestChatCompletion がログに残す。
   */
  fallbackDef?: AiModelDef;
};

export function resolveAiModelChoice(
  catalog: AiCatalog,
  choice: AiModelChoice,
  useCase: AiUseCase
): ResolvedAiModel {
  // 台帳に無いIDが保存されていても（提供終了したモデルを台帳から消した等）、
  // コード側の既定値に落ちて動き続ける
  const def =
    findAiModel(catalog, choice.modelId) ??
    findAiModel(catalog, DEFAULT_AI_MODEL_SETTINGS[useCase].modelId) ??
    AI_MODEL_DEF_BY_ID.get(DEFAULT_AI_MODEL_SETTINGS[useCase].modelId);
  // 既定値のIDがコード側の定義にも無い、は書き間違いなのでテストで落とす
  if (!def) throw new Error(`AIモデルの既定値が AI_MODEL_DEFS にありません: ${useCase}`);

  const effort =
    choice.reasoningEffort && def.reasoningEfforts.includes(choice.reasoningEffort)
      ? choice.reasoningEffort
      : def.reasoningEfforts[0];

  // 既定モデルはコード側の定義から引く。台帳の既定モデル行が消えていても
  // 逃げ先が無くならないようにするため
  const codeDefault = AI_MODEL_DEF_BY_ID.get(DEFAULT_AI_MODEL_SETTINGS[useCase].modelId);
  const fallbackDef = codeDefault && codeDefault.id !== def.id ? codeDefault : undefined;

  return {
    def,
    ...(effort ? { reasoningEffort: effort } : {}),
    ...(fallbackDef ? { fallbackDef } : {}),
  };
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
