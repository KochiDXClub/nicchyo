import { describe, expect, it } from "vitest";
import { AiNoteInputSchema, noteEmbeddingText, rowToAiNote } from "./aiNotes";

const VALID = {
  title: "混む時間",
  content: "10時から11時は並びます",
  forVisitors: true,
  forVendor: false,
};

describe("AiNoteInputSchema", () => {
  it("トピックタイトル・本文・届け先がそろっていれば通す（前後の空白は落とす）", () => {
    const parsed = AiNoteInputSchema.parse({ ...VALID, title: "  混む時間  " });
    expect(parsed.title).toBe("混む時間");
  });

  it("どのにちよさんにも届けないノートは受け付けない", () => {
    const result = AiNoteInputSchema.safeParse({ ...VALID, forVisitors: false, forVendor: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("届け先を1つ以上選んでください");
  });

  it("空のトピックタイトル・空の本文・長すぎる本文は受け付けない", () => {
    expect(AiNoteInputSchema.safeParse({ ...VALID, title: "   " }).error?.issues[0]?.message).toBe(
      "トピックタイトルを入れてください"
    );
    expect(AiNoteInputSchema.safeParse({ ...VALID, content: "" }).success).toBe(false);
    expect(AiNoteInputSchema.safeParse({ ...VALID, content: "あ".repeat(1001) }).success).toBe(false);
  });
});

describe("noteEmbeddingText", () => {
  it("トピックタイトルと本文をつなげて、トピックタイトルにしか無い言葉でも探せるようにする", () => {
    expect(noteEmbeddingText({ title: "お支払い方法", content: "現金だけ" })).toBe("お支払い方法\n現金だけ");
  });
});

describe("rowToAiNote", () => {
  it("DBの行を画面の形にする", () => {
    const note = rowToAiNote({
      id: "n1",
      title: "お店のメモ",
      content: "芋天が人気",
      for_visitors: true,
      for_vendor: true,
      has_embedding: false,
      updated_at: "2026-10-01T00:00:00Z",
    });
    expect(note).toEqual({
      id: "n1",
      title: "お店のメモ",
      content: "芋天が人気",
      forVisitors: true,
      forVendor: true,
      searchable: false,
      updatedAt: "2026-10-01T00:00:00Z",
    });
  });
});
