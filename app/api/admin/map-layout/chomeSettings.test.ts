import { describe, expect, it } from "vitest";
import { loadMarketAreas } from "./chomeSettings";

type Result = { data: unknown[] | null; error: { code: string } | null };

/** from(テーブル名) → select → order の順に呼ばれる Supabase クライアントの代わり */
function fakeSupabase(result: Result) {
  return {
    from: () => ({
      select: () => ({ order: () => Promise.resolve(result) }),
    }),
  } as never;
}

describe("loadMarketAreas", () => {
  it("市の丁目を読む", async () => {
    const row = { id: "A1", market_id: "M1", label: "一丁目", sort_order: "1" };
    expect(await loadMarketAreas(fakeSupabase({ data: [row], error: null }))).toEqual([
      { id: "A1", marketId: "M1", label: "一丁目", sortOrder: 1 },
    ]);
  });

  it.each(["42P01", "PGRST205"])("テーブルが無いとき（%s）は空で返し、画面が開けなくならない", async (code) => {
    expect(await loadMarketAreas(fakeSupabase({ data: null, error: { code } }))).toEqual([]);
  });

  it("ほかのエラーは投げる", async () => {
    await expect(loadMarketAreas(fakeSupabase({ data: null, error: { code: "XX000" } }))).rejects.toThrow(
      "Failed to load market areas"
    );
  });
});
