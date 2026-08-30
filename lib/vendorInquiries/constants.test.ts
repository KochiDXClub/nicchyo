import { describe, expect, it } from "vitest";
import { isAllowedVendorInquiryImageUrl, isValidStatusForTopic } from "./constants";

describe("isAllowedVendorInquiryImageUrl", () => {
  it("サイト内の絶対パスを許可する", () => {
    expect(isAllowedVendorInquiryImageUrl("/images/a.png")).toBe(true);
  });

  it("Supabase Storage の https URL を許可する", () => {
    expect(isAllowedVendorInquiryImageUrl("https://xyz.supabase.co/storage/v1/object/public/a.png")).toBe(true);
  });

  it.each(["//evil.example/a.png", "http://example.com/a.png", "javascript:alert(1)", "https://evil.com/a.png"])(
    "許可外の %s は拒否する",
    (input) => {
      expect(isAllowedVendorInquiryImageUrl(input)).toBe(false);
    }
  );
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
