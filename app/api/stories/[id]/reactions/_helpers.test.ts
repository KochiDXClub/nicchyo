import { describe, it, expect } from "vitest";
import { normalizeVisitorKey, isValidContentId } from "./_helpers";

describe("normalizeVisitorKey", () => {
  it("空でない文字列（128文字以内）はトリムして通す", () => {
    expect(normalizeVisitorKey("abc")).toBe("abc");
    expect(normalizeVisitorKey("  abc  ")).toBe("abc");
    expect(normalizeVisitorKey("a".repeat(128))).toBe("a".repeat(128));
  });

  it("129文字以上は弾く", () => {
    expect(normalizeVisitorKey("a".repeat(129))).toBeNull();
  });

  it("空文字・空白のみは弾く", () => {
    expect(normalizeVisitorKey("")).toBeNull();
    expect(normalizeVisitorKey("   ")).toBeNull();
  });

  it("文字列以外は弾く", () => {
    expect(normalizeVisitorKey(undefined)).toBeNull();
    expect(normalizeVisitorKey(null)).toBeNull();
    expect(normalizeVisitorKey(123)).toBeNull();
    expect(normalizeVisitorKey({})).toBeNull();
    expect(normalizeVisitorKey(["a"])).toBeNull();
  });
});

describe("isValidContentId", () => {
  it("正しいUUID形式は通す", () => {
    expect(isValidContentId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    // 大文字混じりも許容（正規表現がiフラグ付きのため）
    expect(isValidContentId("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
  });

  it("UUID以外は弾く（500露出防止のためのバリデーション）", () => {
    expect(isValidContentId("")).toBe(false);
    expect(isValidContentId("not-a-uuid")).toBe(false);
    expect(isValidContentId("123e4567-e89b-12d3-a456-42661417400")).toBe(false); // 桁不足
    expect(isValidContentId("123e4567-e89b-12d3-a456-426614174000; DROP TABLE")).toBe(false);
  });
});
