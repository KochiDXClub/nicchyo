import { describe, expect, it } from "vitest";
import { isAllowedVendorInquiryImageUrl, isUuid, isValidStatusForTopic } from "./constants";

describe("isUuid", () => {
  it("UUIDを通す", () => {
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
  });

  it.each(["foo", "", "3f2504e0-4f89-11d3-9a0c", "3f2504e04f8911d39a0c0305e82c3301", "../../etc/passwd"])(
    "UUIDでない %s は拒否する",
    (input) => {
      expect(isUuid(input)).toBe(false);
    }
  );
});

describe("isAllowedVendorInquiryImageUrl", () => {
  it("サイト内の絶対パスを許可する", () => {
    expect(isAllowedVendorInquiryImageUrl("/images/a.png")).toBe(true);
  });

  it("Supabase Storage の https URL を許可する", () => {
    expect(isAllowedVendorInquiryImageUrl("https://xyz.supabase.co/storage/v1/object/public/a.png")).toBe(true);
  });

  it.each([
    "//evil.example/a.png",
    // ブラウザが `/\` を `//` に正規化するため、プロトコル相対URLと同じく外部ホストを指す
    "/\\evil.example/a.png",
    "http://example.com/a.png",
    "javascript:alert(1)",
    "https://evil.com/a.png",
  ])("許可外の %s は拒否する", (input) => {
    expect(isAllowedVendorInquiryImageUrl(input)).toBe(false);
  });
});

describe("isValidStatusForTopic", () => {
  it.each([
    ["report", "unconfirmed", true],
    ["report", "confirmed", true],
    ["report", "ai_pending", false],
    ["consultation", "in_progress", true],
    ["consultation", "confirmed", false],
    ["question", "ai_pending", true],
    ["question", "resolved", false],
  ] as const)("topic=%s, status=%s -> %s", (topic, status, expected) => {
    expect(isValidStatusForTopic(topic, status)).toBe(expected);
  });
});
