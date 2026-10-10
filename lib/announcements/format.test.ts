import { describe, expect, it } from "vitest";
import { formatAnnouncementDate, fromJstInputValue, toJstInputValue } from "./format";

describe("お知らせの日時の変換（日本時間）", () => {
  it("日付は日本時間で出す（UTC の前日夜は翌日になる）", () => {
    expect(formatAnnouncementDate("2026-10-11T16:00:00Z")).toBe("2026年10月12日");
  });

  it("入力欄の値 ⇄ ISO を、日本時間でそろえる", () => {
    expect(toJstInputValue("2026-10-11T16:00:00.000Z")).toBe("2026-10-12T01:00");
    expect(fromJstInputValue("2026-10-12T01:00")).toBe("2026-10-11T16:00:00.000Z");
    expect(fromJstInputValue(toJstInputValue("2026-10-17T15:00:00.000Z"))).toBe("2026-10-17T15:00:00.000Z");
  });

  it("空・不正は空／null", () => {
    expect(toJstInputValue(null)).toBe("");
    expect(toJstInputValue("x")).toBe("");
    expect(fromJstInputValue("")).toBeNull();
    expect(fromJstInputValue("あ")).toBeNull();
  });
});
