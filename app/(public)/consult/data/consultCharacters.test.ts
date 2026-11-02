import { describe, expect, it } from "vitest";
import { findConsultCharacter } from "./consultCharacters";

describe("findConsultCharacter", () => {
  it("答えた人の id があれば、その人を返す", () => {
    expect(findConsultCharacter({ speakerId: "yoichisan" })?.id).toBe("yoichisan");
  });

  it("id が無い（前に保存された相談）ときは、名前で引く", () => {
    expect(findConsultCharacter({ speakerName: "よさこちゃん" })?.id).toBe("yosakochan");
  });

  it("id がもういない人のものなら、名前で引き直す", () => {
    expect(findConsultCharacter({ speakerId: "removed", speakerName: "みらいくん" })?.id).toBe(
      "miraikun"
    );
  });

  it("id と名前が食い違うときは id を優先する", () => {
    expect(findConsultCharacter({ speakerId: "nichiyosan", speakerName: "みらいくん" })?.id).toBe(
      "nichiyosan"
    );
  });

  it("どちらでも見つからなければ undefined", () => {
    expect(findConsultCharacter({ speakerId: "removed", speakerName: "だれか" })).toBeUndefined();
    expect(findConsultCharacter({})).toBeUndefined();
    expect(findConsultCharacter({ speakerId: null, speakerName: null })).toBeUndefined();
  });
});
