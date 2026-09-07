import { describe, it, expect } from "vitest";
import {
  buildResponseSchema,
  parseStreamingConsultOutput,
  buildReplyFromTurns,
} from "./promptBuilder";
import { buildStreamingFormatPrompt, CONSULT_MAX_TURNS } from "./prompts/consultConversation";
import {
  CONSULT_CHARACTERS,
  pickConsultCharacters,
} from "@/app/(public)/consult/data/consultCharacters";

const twoChars = CONSULT_CHARACTERS.slice(0, 2);
const oneChar = CONSULT_CHARACTERS.slice(0, 1);

describe("pickConsultCharacters", () => {
  it("選んだキャラがいればその1人だけを返す", () => {
    expect(pickConsultCharacters("miraikun").map((c) => c.id)).toEqual(["miraikun"]);
  });

  it("未選択なら4人の中から1人だけを返す", () => {
    for (let i = 0; i < 20; i += 1) {
      const picked = pickConsultCharacters();
      expect(picked).toHaveLength(1);
      expect(CONSULT_CHARACTERS).toContain(picked[0]);
    }
  });
});

describe("buildResponseSchema", () => {
  it("発話数は1以上・上限は CONSULT_MAX_TURNS（目安は会話ルールに任せる）", () => {
    const schema = buildResponseSchema(oneChar);
    const turns = schema.json_schema.schema.properties.turns;
    expect(turns.minItems).toBe(1);
    expect(turns.maxItems).toBe(CONSULT_MAX_TURNS);
    expect(turns.items.properties.speakerId.enum).toEqual(["nichiyosan"]);
  });
});

describe("buildStreamingFormatPrompt", () => {
  it("TURN行のフォーマット説明を含む", () => {
    const prompt = buildStreamingFormatPrompt(oneChar);
    expect(prompt).toContain("TURN|speakerId|speakerName|text");
    expect(prompt).toContain("nichiyosan=にちよさん");
  });

  it("行数は固定せず上限だけを伝える", () => {
    const prompt = buildStreamingFormatPrompt(oneChar);
    expect(prompt).toContain(`1行以上 ${CONSULT_MAX_TURNS} 行以内`);
    expect(prompt).not.toContain("必ず 4 行");
  });

  it("ENDマーカーの指示を含む", () => {
    const prompt = buildStreamingFormatPrompt(oneChar);
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
