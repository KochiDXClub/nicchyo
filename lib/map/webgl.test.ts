import { describe, expect, it, vi } from "vitest";
import { isWebGLAvailable } from "./webgl";

function docWith(getContext: (type: string) => unknown): Document {
  return { createElement: () => ({ getContext }) } as unknown as Document;
}

describe("isWebGLAvailable", () => {
  it("document が無ければ false", () => {
    expect(isWebGLAvailable(undefined)).toBe(false);
  });

  it("webgl2 が取れれば true で、コンテキストは手放す", () => {
    const loseContext = vi.fn();
    const gl = { getExtension: () => ({ loseContext }) };
    expect(isWebGLAvailable(docWith((t) => (t === "webgl2" ? gl : null)))).toBe(true);
    expect(loseContext).toHaveBeenCalled();
  });

  it("webgl2 が無くても webgl が取れれば true", () => {
    const gl = { getExtension: () => null };
    expect(isWebGLAvailable(docWith((t) => (t === "webgl" ? gl : null)))).toBe(true);
  });

  it("どちらも取れなければ false", () => {
    expect(isWebGLAvailable(docWith(() => null))).toBe(false);
  });

  it("getContext が例外を投げても false", () => {
    expect(
      isWebGLAvailable(
        docWith(() => {
          throw new Error("blocked");
        })
      )
    ).toBe(false);
  });
});
