import { describe, it, expect } from "vitest";
import {
  AI_MODEL_DEFS,
  AI_MODEL_DEF_BY_ID,
  AI_MODEL_IDS,
  AI_USE_CASE_DEFS,
  AI_USE_CASES,
  DEFAULT_AI_MODEL_SETTINGS,
  buildChatCompletionBody,
  isAiModelId,
  isAiUseCase,
  normalizeAiModelSettings,
  resolveAiModelChoice,
  resolveMaxOutputTokens,
  validateAiModelChoice,
} from "./models";

const legacy = resolveAiModelChoice({ modelId: "gpt-4o-mini" }, "consult");
const reasoning = resolveAiModelChoice(
  { modelId: "gpt-5.4-nano", reasoningEffort: "medium" },
  "consult"
);
const reasoningOff = resolveAiModelChoice(
  { modelId: "gpt-5.4-nano", reasoningEffort: "minimal" },
  "consult"
);

describe("AI_MODEL_DEFS", () => {
  it("モデルIDが重複していない", () => {
    expect(new Set(AI_MODEL_IDS).size).toBe(AI_MODEL_IDS.length);
  });

  it("場面ごとの既定モデルはすべて許可リストに載っている", () => {
    // ここが外れると本番の全リクエストが存在しないモデル名で落ちる
    for (const def of AI_USE_CASE_DEFS) {
      expect(AI_MODEL_DEF_BY_ID.has(def.defaultModelId), `${def.useCase} の既定値`).toBe(true);
    }
  });

  it("既定値一式が全場面ぶん揃っている", () => {
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
});

describe("isAiUseCase / isAiModelId", () => {
  it("知っている値だけ通す", () => {
    expect(isAiUseCase("consult")).toBe(true);
    expect(isAiUseCase("unknown")).toBe(false);
    expect(isAiUseCase(null)).toBe(false);
    expect(isAiModelId("gpt-4o-mini")).toBe(true);
    expect(isAiModelId("gpt-4")).toBe(false);
    expect(isAiModelId(123)).toBe(false);
  });
});

describe("validateAiModelChoice", () => {
  it("正しい組み合わせを通す", () => {
    expect(validateAiModelChoice("consult", "gpt-5.4-nano", "low")).toEqual({
      ok: true,
      useCase: "consult",
      choice: { modelId: "gpt-5.4-nano", reasoningEffort: "low" },
    });
  });

  it("推論の深さを省略できる", () => {
    expect(validateAiModelChoice("shopChat", "gpt-4o-mini")).toEqual({
      ok: true,
      useCase: "shopChat",
      choice: { modelId: "gpt-4o-mini" },
    });
    expect(validateAiModelChoice("shopChat", "gpt-4o-mini", "")).toEqual({
      ok: true,
      useCase: "shopChat",
      choice: { modelId: "gpt-4o-mini" },
    });
  });

  it("弾いた理由を返す（管理画面で運営に見せるため）", () => {
    expect(validateAiModelChoice("unknown", "gpt-4o-mini")).toEqual({
      ok: false,
      reason: "unknown_use_case",
    });
    expect(validateAiModelChoice("consult", "gpt-9")).toEqual({
      ok: false,
      reason: "unknown_model",
    });
  });

  it("推論を受け付けないモデルに深さを指定させない", () => {
    expect(validateAiModelChoice("consult", "gpt-4o-mini", "high")).toEqual({
      ok: false,
      reason: "unsupported_reasoning_effort",
    });
  });

  it("そのモデルが受け付けない深さを弾く", () => {
    // none は 5.6 Luna だけが受け付ける
    expect(validateAiModelChoice("consult", "gpt-5.4-nano", "none")).toEqual({
      ok: false,
      reason: "unsupported_reasoning_effort",
    });
    expect(validateAiModelChoice("consult", "gpt-5.6-luna", "none").ok).toBe(true);
  });
});

describe("normalizeAiModelSettings", () => {
  it("DBの値で上書きする", () => {
    const result = normalizeAiModelSettings([
      { use_case: "itinerary", model_id: "gpt-5.4-mini", reasoning_effort: "low" },
    ]);
    expect(result.itinerary).toEqual({ modelId: "gpt-5.4-mini", reasoningEffort: "low" });
  });

  it("行が無い場面は既定値のまま", () => {
    const result = normalizeAiModelSettings([{ use_case: "itinerary", model_id: "gpt-5-nano" }]);
    expect(result.consult).toEqual(DEFAULT_AI_MODEL_SETTINGS.consult);
    expect(Object.keys(result).sort()).toEqual([...AI_USE_CASES].sort());
  });

  it("DBが読めない・空のときは既定値一式を返す", () => {
    expect(normalizeAiModelSettings(null)).toEqual(DEFAULT_AI_MODEL_SETTINGS);
    expect(normalizeAiModelSettings([])).toEqual(DEFAULT_AI_MODEL_SETTINGS);
    expect(normalizeAiModelSettings("壊れたデータ")).toEqual(DEFAULT_AI_MODEL_SETTINGS);
  });

  it("知らないモデル・場面は無視する（既定値に落ちる）", () => {
    const result = normalizeAiModelSettings([
      { use_case: "consult", model_id: "gpt-4-turbo" },
      { use_case: "../../etc/passwd", model_id: "gpt-4o-mini" },
      null,
      "x",
    ]);
    expect(result).toEqual(DEFAULT_AI_MODEL_SETTINGS);
  });
});

describe("resolveAiModelChoice", () => {
  it("知らないモデルIDが保存されていても既定値に落ちる", () => {
    const resolved = resolveAiModelChoice({ modelId: "gpt-4-turbo" }, "consult");
    expect(resolved.def.id).toBe(DEFAULT_AI_MODEL_SETTINGS.consult.modelId);
  });

  it("推論モデルで深さ未指定ならモデルの既定値を使う", () => {
    const resolved = resolveAiModelChoice({ modelId: "gpt-5.4-nano" }, "consult");
    expect(resolved.reasoningEffort).toBe("minimal");
  });

  it("推論しないモデルには深さが付かない", () => {
    expect(legacy.reasoningEffort).toBeUndefined();
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
    expect(buildChatCompletionBody(legacy, { messages, maxOutputTokens: 500, temperature: 0.7 })).toEqual(
      { model: "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 }
    );
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
