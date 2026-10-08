import { describe, it, expect } from "vitest";
import {
  aggregateReactionRows,
  chunkArray,
  mergeReactionCounts,
  parseContentIdsParam,
} from "./reactionCounts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("parseContentIdsParam", () => {
  it("カンマ区切りのUUIDを配列にする（空白トリム・重複除去）", () => {
    expect(parseContentIdsParam(` ${ID_A}, ${ID_B} ,${ID_A}`)).toEqual([
      ID_A,
      ID_B,
    ]);
  });

  it("UUID形式でないものは除外する", () => {
    expect(
      parseContentIdsParam(`${ID_A},abc,1;DROP TABLE,`)
    ).toEqual([ID_A]);
  });

  it("null や空文字は空配列", () => {
    expect(parseContentIdsParam(null)).toEqual([]);
    expect(parseContentIdsParam("")).toEqual([]);
  });

  it("大文字UUIDは小文字に正規化される", () => {
    expect(parseContentIdsParam(ID_A.toUpperCase())).toEqual([ID_A]);
  });
});

describe("aggregateReactionRows", () => {
  const rows = [
    { vendor_content_id: ID_A, visitor_key: "v1" },
    { vendor_content_id: ID_A, visitor_key: "v2" },
    { vendor_content_id: ID_B, visitor_key: "v1" },
  ];

  it("idごとの件数を集計する", () => {
    const result = aggregateReactionRows(rows);
    expect(result.counts).toEqual({ [ID_A]: 2, [ID_B]: 1 });
    expect(result.reactedIds).toEqual([]);
  });

  it("visitorKey を渡すとハート済みidも返す", () => {
    const result = aggregateReactionRows(rows, "v1");
    expect(result.reactedIds.sort()).toEqual([ID_A, ID_B].sort());
  });

  it("行が空なら空の結果", () => {
    expect(aggregateReactionRows([], "v1")).toEqual({
      counts: {},
      reactedIds: [],
    });
  });
});

describe("chunkArray", () => {
  it("指定サイズで分割する", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("サイズ以下ならそのまま1チャンク", () => {
    expect(chunkArray([1, 2], 30)).toEqual([[1, 2]]);
  });
});

describe("mergeReactionCounts", () => {
  it("複数チャンクの結果をマージする", () => {
    const merged = mergeReactionCounts([
      { counts: { [ID_A]: 2 }, reactedIds: [ID_A] },
      { counts: { [ID_B]: 5 }, reactedIds: [] },
    ]);
    expect(merged.counts).toEqual({ [ID_A]: 2, [ID_B]: 5 });
    expect(merged.reactedIds).toEqual([ID_A]);
  });
});
