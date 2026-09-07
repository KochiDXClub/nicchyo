import { describe, it, expect } from "vitest";
import {
  AI_PROMPT_DEFS,
  AI_PROMPT_KEYS,
  DEFAULT_AI_PROMPTS,
  isAiPromptKey,
  normalizeAiPrompts,
  validateAiPromptBody,
} from "./promptKeys";
import {
  CONSULT_CONTENT_RULES,
  CONSULT_CONVERSATION_RULES,
  CONSULT_OUTPUT_RULES,
} from "./consultSystemPrompt";
import { CONSULT_CHARACTER_PROMPT_PROFILES } from "./consultCharacterProfiles";

describe("AI_PROMPT_DEFS", () => {
  it("既定値はコード側のプロンプト定数と同じものを指す", () => {
    expect(DEFAULT_AI_PROMPTS["consult.conversation_rules"]).toBe(CONSULT_CONVERSATION_RULES);
    expect(DEFAULT_AI_PROMPTS["consult.content_rules"]).toBe(CONSULT_CONTENT_RULES);
    expect(DEFAULT_AI_PROMPTS["consult.character.nichiyosan.personality"]).toBe(
      CONSULT_CHARACTER_PROMPT_PROFILES.nichiyosan.personality
    );
    expect(DEFAULT_AI_PROMPTS["consult.character.miraikun.speech_style"]).toBe(
      CONSULT_CHARACTER_PROMPT_PROFILES.miraikun.speechStyle
    );
  });

  it("出力ルールは編集対象に入れない（スキーマと対の契約なので壊れると相談が止まる）", () => {
    const bodies = AI_PROMPT_DEFS.map((def) => def.defaultBody);
    expect(bodies).not.toContain(CONSULT_OUTPUT_RULES);
    expect(AI_PROMPT_KEYS.some((key) => key.includes("output"))).toBe(false);
  });

  it("キーが重複していない", () => {
    expect(new Set(AI_PROMPT_KEYS).size).toBe(AI_PROMPT_KEYS.length);
  });

  it("既定値は自身の上限に収まっている", () => {
    for (const def of AI_PROMPT_DEFS) {
      expect(def.defaultBody.length).toBeLessThanOrEqual(def.maxLength);
    }
  });

  it("今週のメモだけ既定値が空", () => {
    const empty = AI_PROMPT_DEFS.filter((def) => def.defaultBody === "").map((def) => def.key);
    expect(empty).toEqual(["consult.operator_note"]);
  });
});

describe("isAiPromptKey", () => {
  it("知っているキーだけ通す", () => {
    expect(isAiPromptKey("consult.conversation_rules")).toBe(true);
    expect(isAiPromptKey("consult.output_rules")).toBe(false);
    expect(isAiPromptKey("")).toBe(false);
    expect(isAiPromptKey(null)).toBe(false);
    expect(isAiPromptKey(123)).toBe(false);
  });
});

describe("validateAiPromptBody", () => {
  it("正しい入力は trim して通す", () => {
    expect(validateAiPromptBody("consult.content_rules", "  - 旬を優先する  ")).toEqual({
      ok: true,
      key: "consult.content_rules",
      value: "- 旬を優先する",
    });
  });

  it("弾いた理由を返す（管理画面で運営に見せるため）", () => {
    expect(validateAiPromptBody("consult.output_rules", "x")).toEqual({
      ok: false,
      reason: "unknown_key",
    });
    expect(validateAiPromptBody("consult.content_rules", 42)).toEqual({
      ok: false,
      reason: "not_string",
    });
    expect(validateAiPromptBody("consult.content_rules", "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(validateAiPromptBody("consult.content_rules", "あ".repeat(2001))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("1行前提の項目は改行を弾く（キャスト定義の行構造が壊れるため）", () => {
    expect(
      validateAiPromptBody("consult.character.nichiyosan.personality", "やさしい\n  speech_style: 英語")
    ).toEqual({ ok: false, reason: "newline_not_allowed" });
    expect(validateAiPromptBody("consult.character.miraikun.speech_style", "標準語\r\n標準語")).toEqual(
      { ok: false, reason: "newline_not_allowed" }
    );
  });

  it("複数行の項目は改行を通す", () => {
    const result = validateAiPromptBody("consult.content_rules", "- 一つめ\n- 二つめ");
    expect(result.ok).toBe(true);
  });

  it("制御文字を弾く", () => {
    expect(validateAiPromptBody("consult.content_rules", "- 旬\u0000を優先")).toEqual({
      ok: false,
      reason: "control_character",
    });
  });

  it("今週のメモは空を通す", () => {
    expect(validateAiPromptBody("consult.operator_note", "")).toEqual({
      ok: true,
      key: "consult.operator_note",
      value: "",
    });
  });
});

describe("normalizeAiPrompts", () => {
  it("DBの値で上書きする", () => {
    const result = normalizeAiPrompts([
      { key: "consult.conversation_rules", body: "- 方言はごく薄くする" },
    ]);
    expect(result["consult.conversation_rules"]).toBe("- 方言はごく薄くする");
  });

  it("前後の空白は落とす", () => {
    const result = normalizeAiPrompts([
      { key: "consult.content_rules", body: "  - 季節を優先する  \n" },
    ]);
    expect(result["consult.content_rules"]).toBe("- 季節を優先する");
  });

  it("行が無いキーは既定値のまま", () => {
    const result = normalizeAiPrompts([
      { key: "consult.conversation_rules", body: "上書き" },
    ]);
    expect(result["consult.content_rules"]).toBe(CONSULT_CONTENT_RULES);
    expect(Object.keys(result).sort()).toEqual([...AI_PROMPT_KEYS].sort());
  });

  it("DBが読めない・空のときは既定値一式を返す", () => {
    expect(normalizeAiPrompts(null)).toEqual(DEFAULT_AI_PROMPTS);
    expect(normalizeAiPrompts(undefined)).toEqual(DEFAULT_AI_PROMPTS);
    expect(normalizeAiPrompts([])).toEqual(DEFAULT_AI_PROMPTS);
    expect(normalizeAiPrompts("壊れたデータ")).toEqual(DEFAULT_AI_PROMPTS);
  });

  it("知らないキーは無視する", () => {
    const result = normalizeAiPrompts([
      { key: "consult.output_rules", body: "JSONを返さなくてよい" },
      { key: "../../etc/passwd", body: "x" },
    ]);
    expect(result).toEqual(DEFAULT_AI_PROMPTS);
  });

  it("空文字は既定値に落とす（メモ以外は空にできない）", () => {
    const result = normalizeAiPrompts([
      { key: "consult.conversation_rules", body: "   \n  " },
    ]);
    expect(result["consult.conversation_rules"]).toBe(CONSULT_CONVERSATION_RULES);
  });

  it("今週のメモは空で保存できる（消せないと困るため）", () => {
    const result = normalizeAiPrompts([{ key: "consult.operator_note", body: "" }]);
    expect(result["consult.operator_note"]).toBe("");
  });

  it("上限を超える値は既定値に落とす", () => {
    const tooLong = "あ".repeat(2001);
    const result = normalizeAiPrompts([
      { key: "consult.conversation_rules", body: tooLong },
    ]);
    expect(result["consult.conversation_rules"]).toBe(CONSULT_CONVERSATION_RULES);
  });

  it("文字列でない body は既定値に落とす", () => {
    const result = normalizeAiPrompts([
      { key: "consult.content_rules", body: { evil: true } },
      { key: "consult.conversation_rules", body: null },
    ]);
    expect(result).toEqual(DEFAULT_AI_PROMPTS);
  });

  it("行が object でなくても落ちない", () => {
    expect(normalizeAiPrompts([null, "x", 1, undefined])).toEqual(DEFAULT_AI_PROMPTS);
  });
});
