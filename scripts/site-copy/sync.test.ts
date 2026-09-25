import { describe, expect, it } from "vitest";
import texts from "@/content/site-copy/texts.json";
import faq from "@/content/site-copy/faq.json";
import { FAQ_CATEGORIES as UI_CATEGORIES } from "@/app/(public)/faq/data";
import { buildFaq, buildTexts, FAQ_CATEGORIES, parseCsv } from "./sync.mjs";

describe("parseCsv", () => {
  it("セル内の改行・カンマ・二重引用符を読める", () => {
    const csv = '"key","文言"\r\n"a.b","1行目\n2行目, ""引用"""\r\n';
    expect(parseCsv(csv)).toEqual([
      ["key", "文言"],
      ["a.b", '1行目\n2行目, "引用"'],
    ]);
  });

  it("先頭の BOM と末尾の改行なしに対応する", () => {
    expect(parseCsv("﻿key,文言\na.b,x")).toEqual([
      ["key", "文言"],
      ["a.b", "x"],
    ]);
  });
});

describe("buildTexts", () => {
  const header = ["key", "文言", "最大文字数", "備考"];

  it("key と文言の対応を作り、空行と備考列は無視する", () => {
    const { texts: out, errors } = buildTexts([header, ["faq.title", " よくある質問 ", "", "メモ"], ["", "", "", ""]]);
    expect(errors).toEqual([]);
    expect(out).toEqual({ "faq.title": "よくある質問" });
  });

  it("サイトで使っている key がシートから消えたら止める", () => {
    const { errors } = buildTexts([header, ["faq.title", "x", "", ""]], ["faq.title", "faq.lead"]);
    expect(errors).toEqual([expect.stringContaining("faq.lead")]);
  });

  it("空欄・重複・HTML・最大文字数超えを止める", () => {
    const { errors } = buildTexts([
      header,
      ["a.one", "", "", ""],
      ["a.two", "ok", "", ""],
      ["a.two", "dup", "", ""],
      ["a.three", "<b>太字</b>", "", ""],
      ["a.four", "あいうえお", "4", ""],
      ["bad key", "x", "", ""],
    ]);
    expect(errors).toHaveLength(5);
  });

  it("見出しの列がなければ止める", () => {
    const { errors } = buildTexts([["key", "text"]]);
    expect(errors).toEqual([expect.stringContaining("文言")]);
  });
});

describe("buildFaq", () => {
  const header = ["id", "カテゴリ", "質問", "回答"];

  it("行の順に並べ、列の並び順は問わない", () => {
    const { faq: out, errors } = buildFaq([
      ["回答", "id", "質問", "カテゴリ"],
      ["A1", "x-one", "Q1", "map"],
      ["A2", "x-two", "Q2", "general"],
    ]);
    expect(errors).toEqual([]);
    expect(out).toEqual([
      { id: "x-one", category: "map", q: "Q1", a: "A1" },
      { id: "x-two", category: "general", q: "Q2", a: "A2" },
    ]);
  });

  it("知らないカテゴリ・id の重複・空の回答を止める", () => {
    const { errors } = buildFaq([
      header,
      ["x-one", "shops", "Q", "A"],
      ["x-two", "map", "Q", ""],
      ["x-two", "map", "Q", "A"],
    ]);
    expect(errors).toHaveLength(3);
  });
});

describe("今の content/site-copy", () => {
  it("取り込みスクリプトのカテゴリが FAQ 画面のカテゴリと一致している", () => {
    const uiIds = UI_CATEGORIES.map((c) => c.id).filter((id) => id !== "all");
    expect([...FAQ_CATEGORIES].sort()).toEqual([...uiIds].sort());
  });

  it("書き出し → 取り込みで同じ JSON に戻る", () => {
    const textRows = [["key", "文言"], ...Object.entries(texts)];
    const faqRows = [["id", "カテゴリ", "質問", "回答"], ...faq.map((f) => [f.id, f.category, f.q, f.a])];
    expect(buildTexts(textRows, Object.keys(texts))).toEqual({ texts, errors: [] });
    expect(buildFaq(faqRows)).toEqual({ faq, errors: [] });
  });
});
