import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "./fetchAllRows";

type Row = { id: number };

function makeSource(total: number, serverMaxRows = 1000) {
  const rows: Row[] = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  const calls: Array<[number, number]> = [];
  const fetchPage = (from: number, to: number) => {
    calls.push([from, to]);
    // PostgREST の max_rows と同様、要求幅が大きくても max_rows 件で切る
    const end = Math.min(to + 1, from + serverMaxRows);
    return Promise.resolve({ data: rows.slice(from, end), error: null });
  };
  return { rows, calls, fetchPage };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAllRows", () => {
  it("2500 行を順序どおりに全件取得する（最後に空ページを 1 回確認する）", async () => {
    const { rows, calls, fetchPage } = makeSource(2500);
    const result = await fetchAllRows<Row>(fetchPage, { label: "t" });
    expect(result.error).toBeNull();
    expect(result.truncated).toBe(false);
    expect(result.data).toEqual(rows);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2500, 3499],
    ]);
  });

  it("サーバーの max_rows が pageSize より小さくても、受け取った件数ぶん進めて取りこぼさない", async () => {
    const { rows, calls, fetchPage } = makeSource(1200, 500);
    const result = await fetchAllRows<Row>(fetchPage, { label: "t" });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(rows);
    expect(calls.map(([from]) => from)).toEqual([0, 500, 1000, 1200]);
  });

  it("ちょうどページ幅の件数なら空ページまで確認して終わる", async () => {
    const { calls, fetchPage } = makeSource(2000);
    const result = await fetchAllRows<Row>(fetchPage, { label: "t" });
    expect(result.data).toHaveLength(2000);
    expect(calls).toHaveLength(3);
    expect(calls[2]).toEqual([2000, 2999]);
  });

  it("0 件・data が null でも空配列を返す", async () => {
    const result = await fetchAllRows<Row>(
      () => Promise.resolve({ data: null, error: null }),
      { label: "t" }
    );
    expect(result).toEqual({ data: [], error: null, truncated: false });
  });

  it("途中のページがエラーなら部分結果を返さずエラーを伝播する", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 10 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const result = await fetchAllRows<Row>(fetchPage, { label: "t", pageSize: 10 });
    expect(result.error).toEqual({ message: "boom" });
    expect(result.data).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("maxPages に達したら打ち切りを警告して truncated を立てる", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchPage } = makeSource(5000);
    const result = await fetchAllRows<Row>(fetchPage, { label: "products", maxPages: 2 });
    expect(result.truncated).toBe(true);
    expect(result.data).toHaveLength(2000);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("products"));
  });
});
