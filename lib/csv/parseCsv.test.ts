import { describe, expect, it } from "vitest";
import { decodeCsvBuffer, parseCsv, parseCsvWithLines } from "./parseCsv";

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

describe("decodeCsvBuffer", () => {
  const bytes = (values: number[]) => new Uint8Array(values).buffer;

  it("UTF-8（BOM 付きを含む）はそのまま読む", () => {
    expect(decodeCsvBuffer(new TextEncoder().encode("本番号,店名").buffer as ArrayBuffer)).toBe("本番号,店名");
    expect(parseCsv(decodeCsvBuffer(new TextEncoder().encode("\uFEFF本番号,店名").buffer as ArrayBuffer))).toEqual([["本番号", "店名"]]);
  });

  it("UTF-8 として読めなければ Shift_JIS で読み直す（Excel の標準の CSV）", () => {
    // 「本番号,店名」を Shift_JIS で符号化したもの
    const sjis = bytes([0x96, 0x7b, 0x94, 0xd4, 0x8d, 0x86, 0x2c, 0x93, 0x58, 0x96, 0xbc]);
    expect(decodeCsvBuffer(sjis)).toBe("本番号,店名");
  });
});

describe("parseCsvWithLines", () => {
  it("空行や、クォートの中の改行があっても、各行がファイルの何行目から始まるかを返す", () => {
    const text = '本番号,品目\r\n,,\r\n1,"柚子\r\n文旦"\r\n\r\n2,生姜\r\n';
    const { rows, lines } = parseCsvWithLines(text);
    expect(rows).toEqual([
      ["本番号", "品目"],
      ["1", "柚子\r\n文旦"],
      ["2", "生姜"],
    ]);
    expect(lines).toEqual([1, 3, 6]);
  });

  it("LF だけ・CR だけの改行でも数える", () => {
    expect(parseCsvWithLines("a\n\nb\n").lines).toEqual([1, 3]);
    expect(parseCsvWithLines("a\r\rb").lines).toEqual([1, 3]);
  });

  it("parseCsv と同じ行を返す", () => {
    const text = "﻿a,b\r\n1,\"x,y\"\r\n";
    expect(parseCsvWithLines(text).rows).toEqual(parseCsv(text));
  });
});
