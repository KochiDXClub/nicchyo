import { describe, expect, it } from "vitest";
import { MAX_SEARCH_KEYWORD_LENGTH, parseSearchLog } from "./searchLogs";

describe("parseSearchLog", () => {
  it("正しい値は前後の空白を落として受け付ける", () => {
    expect(parseSearchLog({ keyword: "  トマト ", resultCount: 3 })).toEqual({ keyword: "トマト", resultCount: 3 });
    expect(parseSearchLog({ keyword: "いも", resultCount: 0 })).toEqual({ keyword: "いも", resultCount: 0 });
  });

  it("全角英数などの表記ゆれを揃える", () => {
    expect(parseSearchLog({ keyword: "ＴＯＭＡＴＯ", resultCount: 1 })?.keyword).toBe("TOMATO");
    expect(parseSearchLog({ keyword: "ﾄﾏﾄ", resultCount: 1 })?.keyword).toBe("トマト");
  });

  it("改行・NUL などの制御文字を含むキーワードは受け付けない", () => {
    expect(parseSearchLog({ keyword: "トマ\u0000ト", resultCount: 1 })).toBeNull();
    expect(parseSearchLog({ keyword: "トマ\nト", resultCount: 1 })).toBeNull();
  });

  it("短すぎる・長すぎるキーワードは受け付けない", () => {
    expect(parseSearchLog({ keyword: "あ", resultCount: 1 })).toBeNull();
    expect(parseSearchLog({ keyword: "   ", resultCount: 1 })).toBeNull();
    expect(parseSearchLog({ keyword: "あ".repeat(MAX_SEARCH_KEYWORD_LENGTH + 1), resultCount: 1 })).toBeNull();
    expect(parseSearchLog({ keyword: "あ".repeat(MAX_SEARCH_KEYWORD_LENGTH), resultCount: 1 })).not.toBeNull();
  });

  it("件数が整数でない・負・大きすぎるときは受け付けない", () => {
    expect(parseSearchLog({ keyword: "トマト", resultCount: 1.5 })).toBeNull();
    expect(parseSearchLog({ keyword: "トマト", resultCount: -1 })).toBeNull();
    expect(parseSearchLog({ keyword: "トマト", resultCount: 100000 })).toBeNull();
    expect(parseSearchLog({ keyword: "トマト", resultCount: "3" })).toBeNull();
  });

  it("形が違う body は受け付けない", () => {
    expect(parseSearchLog(null)).toBeNull();
    expect(parseSearchLog("トマト")).toBeNull();
    expect(parseSearchLog({ keyword: 123, resultCount: 1 })).toBeNull();
    expect(parseSearchLog({ resultCount: 1 })).toBeNull();
  });
});
