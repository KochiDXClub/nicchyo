import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  AI_MODEL_DEFS,
  AI_MODEL_DEF_BY_ID,
  AI_MODEL_IDS,
  AI_USE_CASE_DEFS,
  AI_USE_CASES,
  CODE_AI_CATALOG,
  DEFAULT_AI_MODEL_SETTINGS,
  REASONING_EFFORTS,
  buildAiCatalog,
  buildChatCompletionBody,
  findAiModel,
  isAiModelId,
  isAiUseCase,
  MAX_REASONING_HEADROOM_TOKENS,
  normalizeAiModelSettings,
  parseAiModelRow,
  parseAiUseCaseRow,
  resolveAiModelChoice,
  resolveMaxOutputTokens,
  validateAiModelChoice,
  type AiCatalog,
} from "./models";

const catalog = CODE_AI_CATALOG;

const legacy = resolveAiModelChoice(catalog, { modelId: "gpt-4o-mini" }, "consult");
const reasoning = resolveAiModelChoice(
  catalog,
  { modelId: "gpt-5.4-nano", reasoningEffort: "medium" },
  "consult"
);
const reasoningOff = resolveAiModelChoice(
  catalog,
  { modelId: "gpt-5.4-nano", reasoningEffort: "minimal" },
  "consult"
);

/** ai_models の1行ぶんの生データ（DBから返る形） */
function modelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "gpt-test",
    label: "テスト用",
    description: "テスト",
    token_param: "max_completion_tokens",
    supports_temperature: false,
    reasoning_efforts: ["minimal", "high"],
    reasoning_headroom_tokens: 1000,
    price_input_per_mtok: 0.1,
    price_output_per_mtok: 0.5,
    is_selectable: true,
    sort_order: 10,
    ...overrides,
  };
}

describe("AI_MODEL_DEFS", () => {
  it("モデルIDが重複していない", () => {
    expect(new Set(AI_MODEL_IDS).size).toBe(AI_MODEL_IDS.length);
  });

  it("機能ごとの既定モデルはすべてコード側の定義に載っている", () => {
    // ここが外れると、台帳が読めないときに全リクエストが落ちる
    for (const def of AI_USE_CASE_DEFS) {
      expect(AI_MODEL_DEF_BY_ID.has(def.defaultModelId), `${def.useCase} の既定値`).toBe(true);
    }
  });

  it("既定値一式が全機能ぶん揃っている", () => {
    expect(Object.keys(DEFAULT_AI_MODEL_SETTINGS).sort()).toEqual([...AI_USE_CASES].sort());
  });

  it("推論モデルには余白が設定されている（本文が空で返るのを防ぐため）", () => {
    for (const def of AI_MODEL_DEFS) {
      if (def.reasoningEfforts.length === 0) continue;
      expect(def.reasoningHeadroomTokens, `${def.id} の余白`).toBeGreaterThan(0);
    }
  });

  it("推論しないモデルは max_tokens、推論モデルは max_completion_tokens を使う", () => {
    for (const def of AI_MODEL_DEFS) {
      const expected = def.reasoningEfforts.length === 0 ? "max_tokens" : "max_completion_tokens";
      expect(def.tokenParam, `${def.id}`).toBe(expected);
    }
  });

  it("モデルが受け付ける深さはすべて既知の語彙に含まれる", () => {
    for (const def of AI_MODEL_DEFS) {
      for (const effort of def.reasoningEfforts) {
        expect(REASONING_EFFORTS, `${def.id} の ${effort}`).toContain(effort);
      }
    }
  });
});

/**
 * コード側の定義とマイグレーションの初期データがズレていないかを見る。
 *
 * 台帳はDBが本体で、コード側の定義はDBが読めないときのフォールバック。
 * 片方だけ直すと、平常時とDB障害時で違うモデルが使われる。
 */
describe("マイグレーションとの突き合わせ", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260907113000_create_ai_model_registry.sql"),
    "utf8"
  );

  /** 初期データから、そのモデルの values タプルだけを切り出す */
  function seedTupleFor(modelId: string): string {
    const start = sql.indexOf(`'${modelId}'`);
    expect(start, `${modelId} が ai_models の初期データにない`).toBeGreaterThan(-1);
    const end = sql.indexOf("),", start);
    return sql.slice(start, end);
  }

  it("コード側のモデルの能力がマイグレーションの初期データと一致している", () => {
    // IDの有無だけを見ると、能力の列がズレても検知できない。
    // ズレると「平常時は400、DB障害時は正常」のように環境で壊れ方が変わる
    for (const def of AI_MODEL_DEFS) {
      const tuple = seedTupleFor(def.id);

      expect(tuple, `${def.id} の token_param`).toContain(`'${def.tokenParam}'`);
      expect(tuple, `${def.id} の supports_temperature`).toContain(
        def.supportsTemperature ? "true," : "false,"
      );
      expect(tuple, `${def.id} の reasoning_efforts`).toContain(
        `'{${def.reasoningEfforts.join(",")}}'`
      );
      expect(tuple, `${def.id} の reasoning_headroom_tokens`).toContain(
        `${def.reasoningEfforts.join(",")}}', ${def.reasoningHeadroomTokens},`
      );
      expect(tuple, `${def.id} の input 価格`).toContain(def.pricing.input.toFixed(2));
      expect(tuple, `${def.id} の output 価格`).toContain(def.pricing.output.toFixed(2));
    }
  });

  it("コード側の機能はすべてマイグレーションの初期データに入っている", () => {
    for (const def of AI_USE_CASE_DEFS) {
      expect(sql, `${def.useCase} が ai_use_cases の初期データにない`).toContain(
        `'${def.useCase}'`
      );
    }
  });

  it("推論の深さの語彙がDBのCHECK制約と一致している", () => {
    // ai_models_reasoning_efforts_valid。ここを増やすときはマイグレーションも要る
    for (const effort of REASONING_EFFORTS) {
      expect(sql, `${effort} がCHECK制約にない`).toContain(`'${effort}'`);
    }
  });
});

describe("isAiUseCase / isAiModelId", () => {
  it("知っている値だけ通す", () => {
    expect(isAiUseCase("consult")).toBe(true);
    expect(isAiUseCase("unknown")).toBe(false);
    expect(isAiUseCase(null)).toBe(false);
    expect(isAiModelId(catalog, "gpt-4o-mini")).toBe(true);
    expect(isAiModelId(catalog, "gpt-4")).toBe(false);
    expect(isAiModelId(catalog, 123)).toBe(false);
  });
});

describe("parseAiModelRow", () => {
  it("DBの行を定義に変換する", () => {
    expect(parseAiModelRow(modelRow())).toEqual({
      id: "gpt-test",
      label: "テスト用",
      description: "テスト",
      tokenParam: "max_completion_tokens",
      supportsTemperature: false,
      reasoningEfforts: ["minimal", "high"],
      reasoningHeadroomTokens: 1000,
      pricing: { input: 0.1, output: 0.5 },
    });
  });

  it("能力の列が壊れている行は捨てる（壊れた能力でリクエストを組まない）", () => {
    expect(parseAiModelRow(modelRow({ token_param: "max_thinking" }))).toBeNull();
    expect(parseAiModelRow(modelRow({ id: "  " }))).toBeNull();
    expect(parseAiModelRow(modelRow({ label: "" }))).toBeNull();
    expect(parseAiModelRow(null)).toBeNull();
    expect(parseAiModelRow("x")).toBeNull();
  });

  it("知らない深さは黙って落とす", () => {
    const parsed = parseAiModelRow(modelRow({ reasoning_efforts: ["low", "ultra", 42] }));
    expect(parsed?.reasoningEfforts).toEqual(["low"]);
  });

  it("1列ずつ正しくても組み合わせが壊れていれば捨てる", () => {
    // 推論モデルに max_tokens を送ると 400 で全リクエストが落ちる
    expect(
      parseAiModelRow(modelRow({ token_param: "max_tokens", reasoning_efforts: ["low"] }))
    ).toBeNull();
    // 余白 0 だと推論だけで枠を使い切り、本文が空のまま 200 で返り続ける
    expect(
      parseAiModelRow(modelRow({ reasoning_efforts: ["low"], reasoning_headroom_tokens: 0 }))
    ).toBeNull();
  });

  it("推論トークンを使わない深さだけなら余白 0 でよい", () => {
    const parsed = parseAiModelRow(
      modelRow({ reasoning_efforts: ["minimal"], reasoning_headroom_tokens: 0 })
    );
    expect(parsed?.reasoningEfforts).toEqual(["minimal"]);
  });

  it("提供終了したモデルは捨てる（読み取り側のフィルタに頼らない）", () => {
    expect(parseAiModelRow(modelRow({ is_selectable: false }))).toBeNull();
  });

  it("temperature は判断できない値なら送らない側に倒す", () => {
    // 送って 400 になるより、送らずにモデル既定値で動くほうが被害が小さい
    expect(parseAiModelRow(modelRow({ supports_temperature: null }))?.supportsTemperature).toBe(
      false
    );
    expect(parseAiModelRow(modelRow({ supports_temperature: "true" }))?.supportsTemperature).toBe(
      false
    );
    expect(parseAiModelRow(modelRow({ supports_temperature: true }))?.supportsTemperature).toBe(
      true
    );
  });

  it("余白は上限でクランプする（桁を間違えても全滅させない）", () => {
    const parsed = parseAiModelRow(modelRow({ reasoning_headroom_tokens: 2000000000 }));
    expect(parsed?.reasoningHeadroomTokens).toBe(MAX_REASONING_HEADROOM_TOKENS);
  });
});

describe("parseAiUseCaseRow", () => {
  it("コードが呼んでいない機能の行は無視する", () => {
    // 行を足しても新しいAI機能は生まれない（呼び出し側はコードにしかない）
    expect(parseAiUseCaseRow({ key: "newFeature", label: "新機能" })).toBeNull();
  });

  it("DBのラベルと説明で上書きする", () => {
    const parsed = parseAiUseCaseRow({
      key: "consult",
      label: "相談（改称）",
      description: "説明を差し替えた",
      model_id: "gpt-5.4-nano",
      reasoning_effort: "low",
    });
    expect(parsed?.def.label).toBe("相談（改称）");
    expect(parsed?.choice).toEqual({ modelId: "gpt-5.4-nano", reasoningEffort: "low" });
  });

  it("ラベルが空ならコード側の値に落ちる", () => {
    const parsed = parseAiUseCaseRow({ key: "consult", label: "  ", model_id: null });
    expect(parsed?.def.label).toBe(AI_USE_CASE_DEFS[0].label);
    expect(parsed?.choice).toBeNull();
  });
});

describe("buildAiCatalog", () => {
  it("DBの行から台帳を組み立てる", () => {
    const built = buildAiCatalog([modelRow()], [{ key: "consult", label: "相談" }]);
    expect(built.models.map((m) => m.id)).toEqual(["gpt-test"]);
    expect(built.useCases.map((u) => u.useCase)).toEqual(["consult"]);
  });

  it("読めない側だけコード側の定義に落ちる", () => {
    const noModels = buildAiCatalog(null, [{ key: "consult", label: "相談" }]);
    expect(noModels.models).toBe(CODE_AI_CATALOG.models);
    expect(noModels.useCases.map((u) => u.useCase)).toEqual(["consult"]);

    const noUseCases = buildAiCatalog([modelRow()], []);
    expect(noUseCases.useCases).toBe(CODE_AI_CATALOG.useCases);
  });

  it("両方読めなければコード側の台帳をそのまま使う", () => {
    expect(buildAiCatalog(null, null)).toEqual(CODE_AI_CATALOG);
  });
});

describe("validateAiModelChoice", () => {
  it("正しい組み合わせを通す", () => {
    expect(validateAiModelChoice(catalog, "consult", "gpt-5.4-nano", "low")).toEqual({
      ok: true,
      useCase: "consult",
      choice: { modelId: "gpt-5.4-nano", reasoningEffort: "low" },
    });
  });

  it("推論の深さを省略できる", () => {
    expect(validateAiModelChoice(catalog, "shopChat", "gpt-4o-mini")).toEqual({
      ok: true,
      useCase: "shopChat",
      choice: { modelId: "gpt-4o-mini" },
    });
    expect(validateAiModelChoice(catalog, "shopChat", "gpt-4o-mini", "")).toEqual({
      ok: true,
      useCase: "shopChat",
      choice: { modelId: "gpt-4o-mini" },
    });
  });

  it("弾いた理由を返す（管理画面で運営に見せるため）", () => {
    expect(validateAiModelChoice(catalog, "unknown", "gpt-4o-mini")).toEqual({
      ok: false,
      reason: "unknown_use_case",
    });
    expect(validateAiModelChoice(catalog, "consult", "gpt-9")).toEqual({
      ok: false,
      reason: "unknown_model",
    });
  });

  it("推論を受け付けないモデルに深さを指定させない", () => {
    expect(validateAiModelChoice(catalog, "consult", "gpt-4o-mini", "high")).toEqual({
      ok: false,
      reason: "unsupported_reasoning_effort",
    });
  });

  it("そのモデルが受け付けない深さを弾く", () => {
    // none は 5.6 Luna だけが受け付ける
    expect(validateAiModelChoice(catalog, "consult", "gpt-5.4-nano", "none")).toEqual({
      ok: false,
      reason: "unsupported_reasoning_effort",
    });
    expect(validateAiModelChoice(catalog, "consult", "gpt-5.6-luna", "none").ok).toBe(true);
  });

  it("台帳に足したモデルは通る（コード側の定義に無くてよい）", () => {
    const extended: AiCatalog = {
      models: [...catalog.models, parseAiModelRow(modelRow())!],
      useCases: catalog.useCases,
    };
    expect(validateAiModelChoice(extended, "consult", "gpt-test", "high").ok).toBe(true);
    // 同じIDでもコード側の台帳では通らない
    expect(validateAiModelChoice(catalog, "consult", "gpt-test").ok).toBe(false);
  });
});

describe("normalizeAiModelSettings", () => {
  it("ai_use_cases の行から割り当てを組み立てる", () => {
    const result = normalizeAiModelSettings(catalog, [
      { key: "itinerary", label: "回り方", model_id: "gpt-5.4-mini", reasoning_effort: "low" },
    ]);
    expect(result.itinerary).toEqual({ modelId: "gpt-5.4-mini", reasoningEffort: "low" });
  });

  it("モデル未設定の機能は既定値のまま", () => {
    const result = normalizeAiModelSettings(catalog, [
      { key: "itinerary", label: "回り方", model_id: null },
    ]);
    expect(result.itinerary).toEqual(DEFAULT_AI_MODEL_SETTINGS.itinerary);
    expect(Object.keys(result).sort()).toEqual([...AI_USE_CASES].sort());
  });

  it("DBが読めない・空のときは既定値一式を返す", () => {
    expect(normalizeAiModelSettings(catalog, null)).toEqual(DEFAULT_AI_MODEL_SETTINGS);
    expect(normalizeAiModelSettings(catalog, [])).toEqual(DEFAULT_AI_MODEL_SETTINGS);
    expect(normalizeAiModelSettings(catalog, "壊れたデータ")).toEqual(DEFAULT_AI_MODEL_SETTINGS);
  });

  it("台帳に無いモデル・コードに無い機能は無視する（既定値に落ちる）", () => {
    const result = normalizeAiModelSettings(catalog, [
      { key: "consult", label: "相談", model_id: "gpt-4-turbo" },
      { key: "../../etc/passwd", label: "x", model_id: "gpt-4o-mini" },
      null,
      "x",
    ]);
    expect(result).toEqual(DEFAULT_AI_MODEL_SETTINGS);
  });
});

describe("resolveAiModelChoice", () => {
  it("台帳に無いモデルIDが保存されていても既定値に落ちる", () => {
    const resolved = resolveAiModelChoice(catalog, { modelId: "gpt-4-turbo" }, "consult");
    expect(resolved.def.id).toBe(DEFAULT_AI_MODEL_SETTINGS.consult.modelId);
  });

  it("推論モデルで深さ未指定ならモデルの既定値を使う", () => {
    const resolved = resolveAiModelChoice(catalog, { modelId: "gpt-5.4-nano" }, "consult");
    expect(resolved.reasoningEffort).toBe("minimal");
  });

  it("推論しないモデルには深さが付かない", () => {
    expect(legacy.reasoningEffort).toBeUndefined();
  });

  it("既定モデルが台帳から消えていてもコード側の定義で動き続ける", () => {
    // 提供終了で is_selectable = false にした直後など
    const withoutDefault: AiCatalog = {
      models: catalog.models.filter((m) => m.id !== "gpt-4o-mini"),
      useCases: catalog.useCases,
    };
    const resolved = resolveAiModelChoice(withoutDefault, { modelId: "gpt-4o-mini" }, "consult");
    expect(resolved.def.id).toBe("gpt-4o-mini");
  });
});

describe("findAiModel", () => {
  it("文字列以外は引かない", () => {
    expect(findAiModel(catalog, 42)).toBeUndefined();
    expect(findAiModel(catalog, null)).toBeUndefined();
  });
});

describe("resolveMaxOutputTokens", () => {
  it("推論しないモデルは指定値をそのまま使う", () => {
    expect(resolveMaxOutputTokens(legacy, 280)).toBe(280);
  });

  it("minimal は推論トークンを使わないので上乗せしない", () => {
    expect(resolveMaxOutputTokens(reasoningOff, 280)).toBe(280);
  });

  it("推論を有効にしたら余白を上乗せする（本文が空で返るのを防ぐ）", () => {
    // 280 のまま推論モデルに渡すと、推論だけで枠を使い切って本文が返らない
    expect(resolveMaxOutputTokens(reasoning, 280)).toBe(280 + reasoning.def.reasoningHeadroomTokens);
  });
});

describe("buildChatCompletionBody", () => {
  const messages = [{ role: "system", content: "テスト" }];

  it("現行モデルには従来どおりのボディを組む", () => {
    expect(
      buildChatCompletionBody(legacy, { messages, maxOutputTokens: 500, temperature: 0.7 })
    ).toEqual({ model: "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 });
  });

  it("推論モデルには max_completion_tokens を使う", () => {
    const body = buildChatCompletionBody(reasoning, { messages, maxOutputTokens: 500 });
    expect(body.max_completion_tokens).toBe(500 + reasoning.def.reasoningHeadroomTokens);
    expect(body.max_tokens).toBeUndefined();
  });

  it("temperature を受け付けないモデルには送らない", () => {
    const body = buildChatCompletionBody(reasoning, {
      messages,
      maxOutputTokens: 500,
      temperature: 0.7,
    });
    expect(body.temperature).toBeUndefined();
  });

  it("推論しないモデルには reasoning_effort を送らない", () => {
    const body = buildChatCompletionBody(legacy, { messages, maxOutputTokens: 500 });
    expect(body.reasoning_effort).toBeUndefined();
  });

  it("推論モデルには reasoning_effort を送る", () => {
    const body = buildChatCompletionBody(reasoning, { messages, maxOutputTokens: 500 });
    expect(body.reasoning_effort).toBe("medium");
  });

  it("上限を省略したらトークン上限を送らない（モデル既定にまかせる）", () => {
    // map-agent は従来から上限を指定していない。勝手に上限を足さないこと
    const body = buildChatCompletionBody(reasoning, { messages });
    expect("max_completion_tokens" in body).toBe(false);
    expect("max_tokens" in body).toBe(false);
  });

  it("stream と response_format は指定したときだけ入れる", () => {
    const plain = buildChatCompletionBody(legacy, { messages, maxOutputTokens: 500 });
    expect(plain.stream).toBeUndefined();
    expect("response_format" in plain).toBe(false);

    const streamed = buildChatCompletionBody(legacy, {
      messages,
      maxOutputTokens: 500,
      stream: true,
      responseFormat: { type: "json_object" },
    });
    expect(streamed.stream).toBe(true);
    expect(streamed.response_format).toEqual({ type: "json_object" });
  });
});
