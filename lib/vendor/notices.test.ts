import { describe, expect, it } from "vitest";
import { NOTICE_TITLE_MAX, NoticeInputSchema, rowToNotice } from "./notices";

const valid = { sender: "city", title: "区画の配置が変わります", body: "10月12日から東側の区画が…", important: true };

describe("NoticeInputSchema", () => {
  it("差出人・見出し・本文・大事かどうかを受け付け、前後の空白を落とす", () => {
    const parsed = NoticeInputSchema.parse({ ...valid, title: "  区画  " });
    expect(parsed.title).toBe("区画");
  });

  it("決まっていない差出人は受け付けない", () => {
    expect(NoticeInputSchema.safeParse({ ...valid, sender: "vendor" }).success).toBe(false);
  });

  it("空の見出し・長すぎる見出しは受け付けない", () => {
    expect(NoticeInputSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
    expect(NoticeInputSchema.safeParse({ ...valid, title: "あ".repeat(NOTICE_TITLE_MAX + 1) }).success).toBe(false);
  });
});

describe("rowToNotice", () => {
  it("DB の行を画面で使う形にする", () => {
    expect(
      rowToNotice({ id: "n1", sender: "operator", title: "t", body: "b", important: false, created_at: "2026-10-01T00:00:00Z" })
    ).toEqual({ id: "n1", sender: "operator", title: "t", body: "b", important: false, createdAt: "2026-10-01T00:00:00Z" });
  });
});
