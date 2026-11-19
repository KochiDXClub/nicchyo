import { describe, expect, it } from "vitest";
import { parseCountEvent, USAGE_FEATURES } from "./countEvents";

describe("parseCountEvent", () => {
  it("4 つの機能の利用（usage）を受け付ける", () => {
    for (const feature of USAGE_FEATURES) {
      expect(parseCountEvent({ kind: "usage", feature })).toEqual({ kind: "usage", feature });
    }
  });

  it("知らない種類・種類なしは null", () => {
    expect(parseCountEvent({ kind: "locale", feature: "map" })).toBeNull();
    expect(parseCountEvent({ kind: "__proto__", feature: "map" })).toBeNull();
    expect(parseCountEvent({ feature: "map" })).toBeNull();
  });

  it("知らない機能・文字列でない機能は null", () => {
    expect(parseCountEvent({ kind: "usage", feature: "admin" })).toBeNull();
    expect(parseCountEvent({ kind: "usage", feature: "MAP" })).toBeNull();
    expect(parseCountEvent({ kind: "usage", feature: ["map"] })).toBeNull();
    expect(parseCountEvent({ kind: "usage" })).toBeNull();
  });

  it("余計なキーがあれば null（端末の ID や丁目などを紛れ込ませない）", () => {
    expect(parseCountEvent({ kind: "usage", feature: "map", visitorId: "abc" })).toBeNull();
    expect(parseCountEvent({ kind: "usage", feature: "map", area: "1" })).toBeNull();
  });

  it("オブジェクトでない値は null", () => {
    for (const body of [null, undefined, "usage", 1, true, [], [{ kind: "usage", feature: "map" }]]) {
      expect(parseCountEvent(body)).toBeNull();
    }
  });
});
