import { describe, expect, it } from "vitest";
import { AiNoteInputSchema, noteEmbeddingText, rowToAiNote } from "./aiNotes";

const VALID = {
  topic: "busy",
  title: "混む時間",
  content: "10時から11時は並びます",
  forVisitors: true,
  forVendor: false,
};

describe("AiNoteInputSchema", () => {
  it("話題・タイトル・詳しく・届け先がそろっていれば通す（前後の空白は落とす）", () => {
    const parsed = AiNoteInputSchema.parse({ ...VALID, title: "  混む時間  " });
    expect(parsed.title).toBe("混む時間");
  });

  it("どのにちよさんにも届けないノートは受け付けない", () => {
    const result = AiNoteInputSchema.safeParse({ ...VALID, forVisitors: false, forVendor: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("届け先を1つ以上選んでください");
  });

  it("知らない話題・空のタイトル・長すぎる詳しくは受け付けない", () => {
    expect(AiNoteInputSchema.safeParse({ ...VALID, topic: "secret" }).success).toBe(false);
    expect(AiNoteInputSchema.safeParse({ ...VALID, title: "   " }).success).toBe(false);
    expect(AiNoteInputSchema.safeParse({ ...VALID, content: "あ".repeat(1001) }).success).toBe(false);
  });
});

describe("noteEmbeddingText", () => {
  it("題と本文をつなげて、題にしか無い言葉でも探せるようにする", () => {
    expect(noteEmbeddingText({ title: "支払い", content: "現金だけ" })).toBe("支払い\n現金だけ");
  });
});

describe("rowToAiNote", () => {
  it("DBの行を画面の形にし、知らない話題は「その他」に寄せる", () => {
    const note = rowToAiNote({
      id: "n1",
      topic: "unknown",
      title: "お店のメモ",
      content: "芋天が人気",
      for_visitors: true,
      for_vendor: true,
      has_embedding: false,
      updated_at: "2026-10-01T00:00:00Z",
    });
    expect(note).toMatchObject({ id: "n1", topic: "other", searchable: false, forVisitors: true });
  });
});
