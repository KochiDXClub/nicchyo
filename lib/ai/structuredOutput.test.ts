import { describe, it, expect } from "vitest";
import { parseFirstJsonObject } from "./structuredOutput";

describe("parseFirstJsonObject", () => {
  it("正しい JSON はそのまま読む", () => {
    expect(parseFirstJsonObject('{"turns":[{"text":"おはよう"}]}')).toEqual({
      turns: [{ text: "おはよう" }],
    });
  });

  it("前後の空白は無視する", () => {
    expect(parseFirstJsonObject('  \n{"a":1}\n ')).toEqual({ a: 1 });
  });

  it("同じオブジェクトが2つ続いたら先頭を使う", () => {
    expect(parseFirstJsonObject('{"a":1}\n{"a":1}')).toEqual({ a: 1 });
  });

  it("オブジェクトのあとに文が足されていたら先頭のオブジェクトを使う", () => {
    expect(parseFirstJsonObject('{"a":1} Need valid JSON…')).toEqual({ a: 1 });
    expect(parseFirstJsonObject('{"a":1}*****/')).toEqual({ a: 1 });
  });

  it("文字列の中の括弧・引用符に惑わされない", () => {
    const raw = '{"text":"「}」と {\\"え\\"} を書く","n":{"m":2}}おまけ';
    expect(parseFirstJsonObject(raw)).toEqual({ text: '「}」と {"え"} を書く', n: { m: 2 } });
  });

  it("途中で切れた JSON は直さずに例外にする（出力上限の絞りすぎを隠さない）", () => {
    expect(() => parseFirstJsonObject('{"turns":[{"text":"おは')).toThrow(SyntaxError);
  });

  it("オブジェクトで始まらない返事は例外にする", () => {
    expect(() => parseFirstJsonObject("はい、どうぞ")).toThrow(SyntaxError);
    expect(() => parseFirstJsonObject("")).toThrow(SyntaxError);
  });
});
