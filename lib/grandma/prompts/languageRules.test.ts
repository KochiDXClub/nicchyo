import { describe, expect, it } from "vitest";
import { buildItineraryLanguageInstruction, buildLanguageInstruction } from "./languageRules";

describe("languageRules", () => {
  it("日本語のときは何も足さない", () => {
    expect(buildLanguageInstruction("ja")).toBe("");
    expect(buildItineraryLanguageInstruction("ja")).toBe("");
  });

  it("英語のときは英語で返す指示と、JSON契約を守る指示を含む", () => {
    expect(buildLanguageInstruction("en")).toContain("Reply in English");
    expect(buildItineraryLanguageInstruction("en")).toContain("id and name exactly as given");
  });
});
