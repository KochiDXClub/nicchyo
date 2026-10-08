import { describe, it, expect } from "vitest";
import { computeDisplayStatus } from "./_helpers";

const NOW = new Date("2026-08-12T12:00:00Z");
const FUTURE = "2026-08-13T00:00:00Z";
const PAST = "2026-08-01T00:00:00Z";

describe("computeDisplayStatus", () => {
  it("active かつ期限内なら active", () => {
    expect(computeDisplayStatus("active", FUTURE, NOW)).toBe("active");
  });

  it("active かつ期限切れなら expired", () => {
    expect(computeDisplayStatus("active", PAST, NOW)).toBe("expired");
  });

  it("hidden は期限内でも hidden を優先する", () => {
    expect(computeDisplayStatus("hidden", FUTURE, NOW)).toBe("hidden");
  });

  it("hidden は期限切れでも hidden のまま（非表示にした投稿が勝手に「期限切れ」表示に化けない）", () => {
    expect(computeDisplayStatus("hidden", PAST, NOW)).toBe("hidden");
  });
});
