import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRasterCache, memoImage, rasterCacheStats } from "./rasterCache";

/** 大きさの計算だけ見たいので、ImageData と同じ形の軽い偽物で足りる */
function image(side: number): { width: number; height: number } {
  return { width: side, height: side };
}

describe("memoImage", () => {
  beforeEach(() => {
    clearRasterCache();
  });

  it("同じ鍵なら描き起こしを一度しか呼ばない", async () => {
    const make = vi.fn(async () => image(4));

    const a = await memoImage("k", make);
    const b = await memoImage("k", make);

    expect(make).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("鍵が違えばそれぞれ描き起こす", async () => {
    const make = vi.fn(async () => image(4));

    await memoImage("a", make);
    await memoImage("b", make);

    expect(make).toHaveBeenCalledTimes(2);
    expect(rasterCacheStats().entries).toBe(2);
  });

  it("同時に頼まれても描き起こしは一度で、両方が同じ絵を受け取る", async () => {
    const make = vi.fn(async () => image(4));

    const [a, b] = await Promise.all([memoImage("k", make), memoImage("k", make)]);

    expect(make).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("失敗したものは覚えず、次に頼まれたらやり直す", async () => {
    const make = vi
      .fn()
      .mockRejectedValueOnce(new Error("読み込み失敗"))
      .mockResolvedValueOnce(image(4));

    await expect(memoImage("k", make)).rejects.toThrow("読み込み失敗");
    expect(rasterCacheStats().entries).toBe(0);

    await expect(memoImage("k", make)).resolves.toEqual({ width: 4, height: 4 });
    expect(make).toHaveBeenCalledTimes(2);
  });

  it("上限を超えたら古いものから捨て、いま入れたものは残す", async () => {
    // 1 枚 = 1024*1024*4 = 4MB。上限 8MB なので 3 枚入れると古いものが捨てられる
    const side = 1024;
    for (let i = 0; i < 3; i += 1) {
      await memoImage(`big-${i}`, async () => image(side));
    }

    const { entries, bytes } = rasterCacheStats();
    expect(bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
    expect(entries).toBeLessThan(3);

    // 最後に入れたものは残っている（作り直しが呼ばれない）
    const make = vi.fn(async () => image(side));
    await memoImage("big-2", make);
    expect(make).not.toHaveBeenCalled();
  });
});
