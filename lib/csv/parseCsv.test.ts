import { describe, expect, it } from "vitest";
import { parseCsv } from "./parseCsv";

describe("parseCsv", () => {
  it("BOM と CRLF を扱い、空行を捨てる", () => {
    expect(parseCsv("﻿本番号,枝番\r\n123,4\r\n\r\n")).toEqual([
      ["本番号", "枝番"],
      ["123", "4"],
    ]);
  });

  it("クォートで囲んだ値の中のカンマ・改行・二重引用符を扱う", () => {
    expect(parseCsv('a,b\n"柚子,文旦","1行目\n2行目"\n"店""名""",x')).toEqual([
      ["a", "b"],
      ["柚子,文旦", "1行目\n2行目"],
      ['店"名"', "x"],
    ]);
  });

  it("空の値を保ち、値がすべて空の行は捨てる", () => {
    expect(parseCsv("1,,3\n,,\n4,5,")).toEqual([
      ["1", "", "3"],
      ["4", "5", ""],
    ]);
  });

  it("末尾に改行が無くても最後の行を読む", () => {
    expect(parseCsv("a\nb")).toEqual([["a"], ["b"]]);
  });
});
