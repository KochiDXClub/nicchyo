import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("BOM 付きで、ヘッダーと行を CRLF でつなぐ", () => {
    const csv = toCsv([{ a: 1, b: "x" }], ["a", "b"]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1)).toBe('"a","b"\r\n"1","x"');
  });

  it("引用符を二重にし、null・undefined は空にする", () => {
    expect(toCsv([{ a: 'say "hi"', b: null, c: undefined }], ["a", "b", "c"]).slice(1)).toBe(
      '"a","b","c"\r\n"say ""hi""","",""'
    );
  });

  it("数式として実行されうる先頭の文字を無効化する", () => {
    for (const cell of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx"]) {
      expect(toCsv([{ a: cell }], ["a"]).split("\r\n")[1]).toBe(`"'${cell}"`);
    }
  });

  it("行が無ければヘッダーだけ", () => {
    expect(toCsv([], ["a"]).slice(1)).toBe('"a"');
  });
});
