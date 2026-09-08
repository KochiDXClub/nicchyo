import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  AI_CONVERSATION_SETTING_DEFS,
  DEFAULT_AI_CONVERSATION_SETTINGS,
  normalizeAiConversationSettings,
  validateAiConversationSettingValue,
} from "./conversationSettings";

describe("validateAiConversationSettingValue", () => {
  it("範囲内の整数だけを受け付ける", () => {
    expect(validateAiConversationSettingValue("consult.max_turns", 2)).toEqual({
      ok: true,
      key: "consult.max_turns",
      value: 2,
    });
  });

  it("知らないキーを弾く", () => {
    expect(validateAiConversationSettingValue("consult.unknown", 1)).toEqual({
      ok: false,
      reason: "unknown_key",
    });
  });

  it("整数でない値を弾く", () => {
    for (const value of [1.5, "2", null, undefined, NaN]) {
      expect(validateAiConversationSettingValue("consult.max_turns", value)).toEqual({
        ok: false,
        reason: "not_integer",
      });
    }
  });

  it("範囲外を弾く（発話数を10にすると吹き出しが10個並ぶ）", () => {
    expect(validateAiConversationSettingValue("consult.max_turns", 10)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
    expect(validateAiConversationSettingValue("consult.max_output_tokens", 50)).toEqual({
      ok: false,
      reason: "out_of_range",
    });
  });
});

describe("normalizeAiConversationSettings", () => {
  it("DBの値で上書きする", () => {
    expect(
      normalizeAiConversationSettings([{ key: "consult.history_limit", value: 2 }])[
        "consult.history_limit"
      ]
    ).toBe(2);
  });

  it("壊れた行は既定値に落とす（設定が壊れてもAIは動き続ける）", () => {
    const settings = normalizeAiConversationSettings([
      { key: "consult.max_turns", value: 99 },
      { key: "consult.max_output_tokens", value: "たくさん" },
      null,
      "ごみ",
    ]);
    expect(settings).toEqual(DEFAULT_AI_CONVERSATION_SETTINGS);
  });

  it("読めなければ既定値一式を返す", () => {
    expect(normalizeAiConversationSettings(null)).toEqual(DEFAULT_AI_CONVERSATION_SETTINGS);
  });
});

/**
 * コード側の定義とマイグレーションの初期データを突き合わせる。
 *
 * DBが正本で、コード側はDBが読めないときのフォールバック。片方だけ直すと
 * 平常時とDB障害時で違う値が使われるので、ズレたらここで落とす。
 * （lib/ai/models.test.ts が ai_models に対してやっているのと同じ）
 */
describe("マイグレーションの初期データとの突き合わせ", () => {
  const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
  const MIGRATION_FILE = "20260907160000_create_ai_conversation_settings.sql";
  const sql = readFileSync(join(MIGRATIONS_DIR, MIGRATION_FILE), "utf-8");

  it("すべてのキーがマイグレーションに入っている", () => {
    for (const def of AI_CONVERSATION_SETTING_DEFS) {
      expect(sql).toContain(`'${def.key}'`);
    }
  });

  it("既定値と上下限がマイグレーションと一致する", () => {
    for (const def of AI_CONVERSATION_SETTING_DEFS) {
      // 初期データの行は ('キー', 値, 下限, 上限) の並びで書いてある
      const row = new RegExp(
        `\\('${def.key.replace(".", "\\.")}',\\s*(-?\\d+),\\s*(-?\\d+),\\s*(-?\\d+)\\)`
      ).exec(sql);
      expect(row, `${def.key} の初期データが読み取れない`).not.toBeNull();
      expect(Number(row![1]), `${def.key} の既定値`).toBe(def.defaultValue);
      expect(Number(row![2]), `${def.key} の下限`).toBe(def.minValue);
      expect(Number(row![3]), `${def.key} の上限`).toBe(def.maxValue);
    }
  });

  it("上下限を変える別のマイグレーションが増えていない（増えたらこのテストを向け直す）", () => {
    // 上のテストは1つのファイルだけを見ている。あとから別のマイグレーションで
    // 範囲を変えると、コード側とのズレを検知できなくなる
    const others = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql") && name !== MIGRATION_FILE)
      .filter((name) => {
        const body = readFileSync(join(MIGRATIONS_DIR, name), "utf-8");
        return (
          body.includes("ai_conversation_settings") &&
          (body.includes("min_value") || body.includes("max_value"))
        );
      });
    expect(others).toEqual([]);
  });

  it("APIから行を作れないようにしてある（行を足しても設定は増えない）", () => {
    // 型だけでは、型を無視した呼び出しやSQLの直叩きは止まらない
    expect(sql).toContain("revoke insert, delete, truncate on public.ai_conversation_settings");

    const types = readFileSync(join(process.cwd(), "types/database.extensions.ts"), "utf-8");
    const table = types.slice(types.indexOf("ai_conversation_settings: {"));
    expect(table.slice(0, table.indexOf("};"))).toContain("Insert: never");
  });
});
