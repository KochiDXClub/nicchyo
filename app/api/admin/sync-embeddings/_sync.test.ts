import { describe, expect, it } from "vitest";
import { toKnowledgeEntries } from "./_sync";

describe("toKnowledgeEntries", () => {
  it("trims values and maps an empty image_url to null", () => {
    expect(
      toKnowledgeEntries([
        { id: " kb-001 ", category: " grandma ", title: " 見出し ", content: " 本文 ", image_url: " " },
        { id: "kb-002", category: "place", title: "", content: "本文2", image_url: "/images/a.webp" },
      ])
    ).toEqual([
      { id: "kb-001", category: "grandma", title: "見出し", content: "本文", image_url: null },
      { id: "kb-002", category: "place", title: "", content: "本文2", image_url: "/images/a.webp" },
    ]);
  });

  it("rejects an empty table, a missing content, and duplicate ids", () => {
    expect(() => toKnowledgeEntries([])).toThrow("empty");
    expect(() => toKnowledgeEntries([{ id: "kb-001", category: "a", title: "b", content: " ", image_url: null }])).toThrow(
      "Invalid or duplicate"
    );
    const row = { id: "kb-001", category: "a", title: "b", content: "c", image_url: null };
    expect(() => toKnowledgeEntries([row, row])).toThrow("Invalid or duplicate");
  });
});
