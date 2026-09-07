import { describe, it, expect } from "vitest";
import { resolveGrandmaPose } from "./pose";

const base = { isListening: false, isStreaming: false, aiStatus: "idle" as const };

describe("resolveGrandmaPose", () => {
  it("何も起きていなければ待機", () => {
    expect(resolveGrandmaPose(base)).toBe("idle");
  });

  it("音声入力中は listening", () => {
    expect(resolveGrandmaPose({ ...base, isListening: true })).toBe("listening");
  });

  it("ストリーミング中は speaking", () => {
    expect(resolveGrandmaPose({ ...base, isStreaming: true })).toBe("speaking");
  });

  it("応答待ちは thinking", () => {
    expect(resolveGrandmaPose({ ...base, aiStatus: "thinking" })).toBe("thinking");
  });

  it("音声入力が他のどの状態よりも優先される", () => {
    expect(
      resolveGrandmaPose({ isListening: true, isStreaming: true, aiStatus: "thinking" })
    ).toBe("listening");
  });

  it("ストリーミングが始まれば aiStatus が thinking のままでも speaking になる", () => {
    expect(
      resolveGrandmaPose({ ...base, isStreaming: true, aiStatus: "thinking" })
    ).toBe("speaking");
  });

  it("回答後（answered）は待機に戻る", () => {
    expect(resolveGrandmaPose({ ...base, aiStatus: "answered" })).toBe("idle");
  });

  it("エラー時も待機に戻る", () => {
    expect(resolveGrandmaPose({ ...base, aiStatus: "error" })).toBe("idle");
  });
});
