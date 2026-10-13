import { describe, expect, it } from "vitest";
import { PhotoSpriteRegistry } from "./photoSpriteRegistry";

const BASE = 3;
const DETAIL = 6;
const make = (maxDetail = 2) => new PhotoSpriteRegistry({ baseRatio: BASE, maxDetail });

describe("PhotoSpriteRegistry", () => {
  it("同じ細かさは二度頼まない。細かい版は等倍版のあとに頼める", () => {
    const r = make();
    expect(r.want("a", BASE)).toBe(true);
    expect(r.want("a", BASE)).toBe(false);
    expect(r.want("a", DETAIL)).toBe(true);
    expect(r.want("a", DETAIL)).toBe(false);
    // 細かい版を頼んだあとに等倍版は頼まない（上限で戻すときを除く）
    expect(r.want("a", BASE)).toBe(false);
    expect(r.want("a", BASE, true)).toBe(true);
  });

  it("等倍版より先に細かい版が仕上がったら、遅れて届いた等倍版は捨てる", () => {
    const r = make();
    r.want("a", BASE);
    r.want("a", DETAIL);
    expect(r.done("a", DETAIL)).toBe(true);
    expect(r.done("a", BASE)).toBe(false);
  });

  it("細かい版が失敗したら、登録済みの等倍版に戻り、また頼み直せる", () => {
    const r = make();
    r.want("a", BASE);
    r.done("a", BASE);
    r.want("a", DETAIL);
    r.failed("a", DETAIL);
    expect(r.want("a", DETAIL)).toBe(true);
  });

  it("等倍版の結果を捨てたあとで細かい版が失敗しても、もう一度頼める（仮画像のまま残らない）", () => {
    const r = make();
    r.want("a", BASE);
    r.want("a", DETAIL);
    expect(r.done("a", BASE)).toBe(false);
    r.failed("a", DETAIL);
    expect(r.has("a")).toBe(false);
    expect(r.want("a", BASE)).toBe(true);
  });

  it("細かい版が上限を超えたら、最も長く使っていないものから戻す", () => {
    const r = make(2);
    for (const id of ["a", "b", "c"]) {
      r.want(id, DETAIL);
      r.done(id, DETAIL);
    }
    expect(r.overflow()).toEqual(["a"]);
    expect(r.overflow()).toEqual([]);
  });

  it("見えている（touch した）ものは後回しにする", () => {
    const r = make(2);
    for (const id of ["a", "b"]) {
      r.want(id, DETAIL);
      r.done(id, DETAIL);
    }
    r.touch("a");
    r.want("c", DETAIL);
    r.done("c", DETAIL);
    expect(r.overflow()).toEqual(["b"]);
  });

  it("等倍に戻したものは上限の数に入らない。戻すのに失敗したら、また上限の対象になる", () => {
    const r = make(1);
    for (const id of ["a", "b"]) {
      r.want(id, DETAIL);
      r.done(id, DETAIL);
    }
    const [evicted] = r.overflow();
    expect(evicted).toBe("a");
    expect(r.want("a", BASE, true)).toBe(true);
    r.done("a", BASE);
    expect(r.overflow()).toEqual([]);

    const [next] = (r.want("c", DETAIL), r.done("c", DETAIL), r.overflow());
    expect(next).toBe("b");
    r.want("b", BASE, true);
    r.failed("b", BASE);
    // 細かい版のまま残った b は、また上限の数に入り、次に上限を超えたとき戻す対象になる
    r.want("d", DETAIL);
    r.done("d", DETAIL);
    expect(r.overflow()).toEqual(["c", "b"]);
    expect(r.overflow()).toEqual([]);
  });
});
