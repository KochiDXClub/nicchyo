import { describe, expect, it } from "vitest";
import { DEFAULT_AI_PROMPTS } from "@/lib/grandma/prompts/promptKeys";
import { resolveShopCharacter } from "./character";

describe("resolveShopCharacter", () => {
  it("選んでいないお店は、既定のにちよさん", () => {
    const character = resolveShopCharacter(null, DEFAULT_AI_PROMPTS);
    expect(character.view.id).toBe("nichiyosan");
    expect(character.profile).toContain("土佐弁");
  });

  it("選んだキャラの人格を使う", () => {
    const character = resolveShopCharacter("miraikun", DEFAULT_AI_PROMPTS);
    expect(character.view.name).toBe("みらいくん");
    expect(character.profile).toContain("標準語");
  });

  it("運営がDBで書き換えた人格が優先される", () => {
    const prompts = { ...DEFAULT_AI_PROMPTS, "consult.character.yosakochan.profile": "運営が直した文面" };
    expect(resolveShopCharacter("yosakochan", prompts).profile).toBe("運営が直した文面");
  });

  it("画面に渡す分に人格の文面を含めない", () => {
    expect(resolveShopCharacter(null, DEFAULT_AI_PROMPTS).view).not.toHaveProperty("profile");
  });
});
