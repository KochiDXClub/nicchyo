import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/client", () => ({ createClient: vi.fn() }));

import { PHOTO_ONLY_TITLE, postTitle } from "./postsService";

describe("postTitle（管理画面などの見出しに使う title）", () => {
  it("ひとことの先頭50字を使う", () => {
    expect(postTitle("今日は文旦が入りました")).toBe("今日は文旦が入りました");
    expect(postTitle("あ".repeat(60))).toHaveLength(50);
  });

  it("ひとこと無しの投稿は「写真だけの投稿」にして、見出しを空欄にしない", () => {
    expect(postTitle("")).toBe(PHOTO_ONLY_TITLE);
    expect(postTitle("   ")).toBe(PHOTO_ONLY_TITLE);
  });
});
