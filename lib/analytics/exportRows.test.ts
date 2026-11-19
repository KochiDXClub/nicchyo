import { describe, expect, it, vi } from "vitest";
import { aggregateExportRows, readAllExportRows } from "./exportRows";

describe("CSV export", () => {
  it("上限以下の全ページを取得する", async () => {
    const rows = Array.from({ length: 1250 }, (_, i) => i);
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(await readAllExportRows(fetchPage)).toHaveLength(1250);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
  it("上限超過とDBエラーを黙って部分出力しない", async () => {
    await expect(readAllExportRows(async () => ({ data: [1, 2], error: null }), 2, 2)).rejects.toThrow("上限");
    await expect(readAllExportRows(async () => ({ data: null, error: { message: "failure" } }))).rejects.toThrow();
  });
  it("日時を日本時間に揃え、ページのクエリを除いて集計する", () => {
    expect(aggregateExportRows([{ time: "2026-01-01T16:00:00Z", path: "/map?q=private" }], "time", "path"))
      .toEqual([{ date: "2026-01-02", category: "/map", count: 1 }]);
  });
});
