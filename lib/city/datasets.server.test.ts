import { describe, expect, it } from "vitest";
import { fetchCityDataset } from "./datasets.server";

function fakeClient(tables: Record<string, unknown[]>) {
  const eqCalls: Record<string, [string, unknown][]> = {};
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          (eqCalls[table] ??= []).push([column, value]);
          return builder;
        },
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data: tables[table] ?? [], error: null }),
      };
      return builder;
    },
  };
  return { client, eqCalls };
}

describe("fetchCityDataset categories", () => {
  it("掲載が許可された店舗だけを数える（listing_status で明示的に絞る）", async () => {
    const { client, eqCalls } = fakeClient({
      categories: [
        { id: "c1", name: "野菜" },
        { id: "c2", name: "  " },
      ],
      vendors: [{ category_id: "c1" }, { category_id: "c1" }, { category_id: "c2" }, { category_id: null }],
    });
    const dataset = await fetchCityDataset(
      client as unknown as Parameters<typeof fetchCityDataset>[0],
      "categories",
      "2026-11-03"
    );
    expect(eqCalls.vendors).toEqual([["listing_status", "allowed"]]);
    expect(dataset.rows).toEqual([
      { category: "野菜", count: 2 },
      { category: "未分類", count: 2 },
    ]);
  });
});
