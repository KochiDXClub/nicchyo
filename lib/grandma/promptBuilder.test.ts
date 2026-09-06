import { describe, it, expect } from "vitest";
import {
  pickConversationPattern,
  parseStreamingConsultOutput,
  buildReplyFromTurns,
} from "./promptBuilder";
import {
  buildConversationPatternPrompt,
  buildStreamingFormatPrompt,
  CONSULT_CONVERSATION_PATTERNS,
} from "./prompts/consultConversation";
import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";

const twoChars = CONSULT_CHARACTERS.slice(0, 2);
const fourChars = CONSULT_CHARACTERS;

describe("pickConversationPattern", () => {
  it("4キャラ以上の場合は all_cast パターン", () => {
    const pattern = pickConversationPattern(fourChars);
    expect(pattern.id).toBe("all_cast");
    expect(pattern.turnCount).toBe(4);
  });

  it("2キャラの場合は4パターンのいずれか", () => {
    const pattern = pickConversationPattern(twoChars);
    const validIds = CONSULT_CONVERSATION_PATTERNS.map((p) => p.id);
    expect(validIds).toContain(pattern.id);
  });
});

describe("buildConversationPatternPrompt", () => {
  it("発話数の指示を含む", () => {
    const pattern = CONSULT_CONVERSATION_PATTERNS[0];
    const prompt = buildConversationPatternPrompt(twoChars, pattern);
    expect(prompt).toContain(`発話数は必ず${pattern.turnCount}つ`);
  });

  it("キャラ名の順序を含む", () => {
    const pattern = CONSULT_CONVERSATION_PATTERNS[0];
    const prompt = buildConversationPatternPrompt(twoChars, pattern);
    expect(prompt).toContain(twoChars[0].name);
    expect(prompt).toContain(twoChars[1].name);
  });
});

describe("buildStreamingFormatPrompt", () => {
  it("TURN行のフォーマット説明を含む", () => {
    const pattern = CONSULT_CONVERSATION_PATTERNS[0];
    const prompt = buildStreamingFormatPrompt(twoChars, pattern);
    expect(prompt).toContain("TURN|speakerId|speakerName|text");
  });

  it("ENDマーカーの指示を含む", () => {
    const pattern = CONSULT_CONVERSATION_PATTERNS[0];
    const prompt = buildStreamingFormatPrompt(twoChars, pattern);
    expect(prompt).toContain("END");
  });
});

describe("parseStreamingConsultOutput", () => {
  it("正常な出力を正しくパース", () => {
    const raw = [
      "TURN|nichiyosan|にちよさん|日曜市のおすすめはこちらです",
      "TURN|yosakochan|よさこちゃん|私もそう思います",
      "SHOP_IDS|1,2,3",
      "IMAGE_URL|null",
      "FOLLOW_UP|次のおすすめは？",
      "SUMMARY|日曜市の案内をしました",
      "END",
    ].join("\n");

    const result = parseStreamingConsultOutput(raw, twoChars);
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0].speakerId).toBe("nichiyosan");
    expect(result.turns[1].speakerId).toBe("yosakochan");
    expect(result.shopIds).toEqual([1, 2, 3]);
    expect(result.imageUrl).toBeNull();
    expect(result.followUpQuestion).toBe("次のおすすめは？");
    expect(result.summary).toBe("日曜市の案内をしました");
  });

  it("TURN行がない場合はフォールバックテキストを使う", () => {
    const raw = "こんにちは、日曜市へようこそ";
    const result = parseStreamingConsultOutput(raw, twoChars);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].speakerId).toBe("nichiyosan");
    expect(result.turns[0].text).toBe("こんにちは、日曜市へようこそ");
  });

  it("IMAGE_URLがhttpsの場合は文字列として保持", () => {
    const raw = [
      "TURN|nichiyosan|にちよさん|テスト",
      "IMAGE_URL|https://example.com/image.jpg",
      "END",
    ].join("\n");
    const result = parseStreamingConsultOutput(raw, twoChars);
    expect(result.imageUrl).toBe("https://example.com/image.jpg");
  });

  it("SHOP_IDSが空の場合は空配列", () => {
    const raw = [
      "TURN|nichiyosan|にちよさん|テスト",
      "SHOP_IDS|",
      "END",
    ].join("\n");
    const result = parseStreamingConsultOutput(raw, twoChars);
    expect(result.shopIds).toEqual([]);
  });
});

describe("buildReplyFromTurns", () => {
  it("ターンをスピーカー名: テキスト形式で結合", () => {
    const turns = [
      { speakerId: "nichiyosan" as const, speakerName: "にちよさん", text: "おすすめですよ" },
      { speakerId: "yosakochan" as const, speakerName: "よさこちゃん", text: "そうですね" },
    ];
    const result = buildReplyFromTurns(turns);
    expect(result).toBe("にちよさん: おすすめですよ\nよさこちゃん: そうですね");
  });

  it("空のターン配列は空文字", () => {
    expect(buildReplyFromTurns([])).toBe("");
  });
});
