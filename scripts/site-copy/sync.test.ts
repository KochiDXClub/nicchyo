import { describe, expect, it } from "vitest";
import texts from "@/content/site-copy/texts.json";
import faq from "@/content/site-copy/faq.json";
import { FAQ_CATEGORIES as UI_CATEGORIES } from "@/app/(public)/faq/data";
import { TEXT_TABS } from "./layout.mjs";
import { buildFaq, buildSheetRows, buildTexts, FAQ_CATEGORIES, parseCsv } from "./sync.mjs";

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
  const header = ["場所", "項目", "文言", "最大文字数", "ID（変更不可）"];
  const sheet = (...rows: string[][]) => [{ name: "LP", rows: [header, ...rows] }];

  it("ID と文言の対応を作り、空行と場所・項目の列は無視する", () => {
    const { texts: out, errors } = buildTexts(
      sheet(["ページ全体", "見出し", " よくある質問 ", "", "faq.title"], ["", "", "", "", ""]),
    );
    expect(errors).toEqual([]);
    expect(out).toEqual({ "faq.title": "よくある質問" });
  });

  it("複数のタブの文言をまとめる", () => {
    const { texts: out, errors } = buildTexts([
      { name: "LP", rows: [header, ["", "", "a", "", "about.one"]] },
      { name: "マップ案内", rows: [header, ["", "", "b", "", "mapIntro.one"]] },
    ]);
    expect(errors).toEqual([]);
    expect(out).toEqual({ "about.one": "a", "mapIntro.one": "b" });
  });

  it("サイトで使っている ID がシートから消えたら止める", () => {
    const { errors } = buildTexts(sheet(["", "", "x", "", "faq.title"]), ["faq.title", "faq.lead"]);
    expect(errors).toEqual([expect.stringContaining("faq.lead")]);
  });

  it("空欄・重複（タブをまたぐものも）・HTML・最大文字数超えを止める", () => {
    const { errors } = buildTexts([
      {
        name: "LP",
        rows: [
          header,
          ["", "", "", "", "a.one"],
          ["", "", "ok", "", "a.two"],
          ["", "", "dup", "", "a.two"],
          ["", "", "<b>太字</b>", "", "a.three"],
          ["", "", "あいうえお", "4", "a.four"],
          ["", "", "x", "", "bad key"],
          ["", "", "**太字の閉じ忘れ", "", "a.five"],
        ],
      },
      { name: "マップ案内", rows: [header, ["", "", "dup", "", "a.two"]] },
    ]);
    expect(errors).toHaveLength(7);
  });

  it("見出しの列がなければ止める", () => {
    const { errors } = buildTexts([{ name: "LP", rows: [["ID（変更不可）", "text"]] }]);
    expect(errors).toEqual([expect.stringContaining("文言")]);
  });
});

describe("buildFaq", () => {
  const header = ["表示順", "表示", "カテゴリ", "質問", "回答", "ID（変更不可）"];

  it("表示順の小さい順に並べ、空欄は最後に行の順で置く。列の並び順は問わない", () => {
    const { faq: out, errors } = buildFaq([
      ["回答", "ID（変更不可）", "質問", "カテゴリ", "表示順"],
      ["A1", "x-one", "Q1", "map", ""],
      ["A2", "x-two", "Q2", "general", "2"],
      ["A3", "x-three", "Q3", "map", "1"],
      ["A4", "x-four", "Q4", "map", ""],
    ]);
    expect(errors).toEqual([]);
    expect(out.map((f) => f.id)).toEqual(["x-three", "x-two", "x-one", "x-four"]);
    expect(out[1]).toEqual({ id: "x-two", category: "general", q: "Q2", a: "A2" });
  });

  it("表示が FALSE の行は載せず、中身も検証しない。空欄・TRUE は表示する", () => {
    const { faq: out, errors } = buildFaq([
      header,
      ["1", "TRUE", "map", "Q1", "A1", "x-one"],
      ["2", "FALSE", "shops", "", "", "x-two"],
      ["3", "", "map", "Q3", "A3", "x-three"],
    ]);
    expect(errors).toEqual([]);
    expect(out.map((f) => f.id)).toEqual(["x-one", "x-three"]);
  });

  it("知らないカテゴリ・ID の重複・空の回答・数字でない表示順を止める", () => {
    const { errors } = buildFaq([
      header,
      ["1", "TRUE", "shops", "Q", "A", "x-one"],
      ["2", "TRUE", "map", "Q", "", "x-two"],
      ["3", "TRUE", "map", "Q", "A", "x-two"],
      ["あ", "TRUE", "map", "Q", "A", "x-three"],
    ]);
    expect(errors).toHaveLength(4);
  });

  it("表示順・表示だけが入った行は質問として数えない", () => {
    const { faq: out, errors } = buildFaq([header, ["1", "TRUE", "map", "Q1", "A1", "x-one"], ["", "FALSE", "", "", "", ""]]);
    expect(errors).toEqual([]);
    expect(out.map((f) => f.id)).toEqual(["x-one"]);
  });

  it("非表示で ID もまだない下書き行は飛ばす", () => {
    const { faq: out, errors } = buildFaq([header, ["1", "TRUE", "map", "Q1", "A1", "x-one"], ["", "FALSE", "", "書きかけ", "", ""]]);
    expect(errors).toEqual([]);
    expect(out.map((f) => f.id)).toEqual(["x-one"]);
  });

  it("全部非表示なら止める", () => {
    const { errors } = buildFaq([header, ["1", "FALSE", "map", "Q", "A", "x-one"]]);
    expect(errors).toEqual([expect.stringContaining("1件もありません")]);
  });
});

describe("今の content/site-copy", () => {
  it("取り込みスクリプトのカテゴリが FAQ 画面のカテゴリと一致している", () => {
    const uiIds = UI_CATEGORIES.map((c) => c.id).filter((id) => id !== "all");
    expect([...FAQ_CATEGORIES].sort()).toEqual([...uiIds].sort());
  });

  it("全部の文言が、どれかのタブに「その他」以外の場所で載る", () => {
    const tabs = buildSheetRows(texts, faq);
    const placed = TEXT_TABS.flatMap(({ name }) => tabs[name].slice(1));
    expect(placed).toHaveLength(Object.keys(texts).length);
    expect(placed.filter((row) => row[0] === "その他")).toEqual([]);
  });

  it("書き出し → 取り込みで同じ JSON に戻る", () => {
    const tabs = buildSheetRows(texts, faq);
    const textSheets = TEXT_TABS.map(({ name }) => ({ name, rows: tabs[name].map((r) => r.map(String)) }));
    expect(buildTexts(textSheets, Object.keys(texts))).toEqual({ texts, errors: [] });
    expect(buildFaq(tabs.FAQ.map((r) => r.map(String)))).toEqual({ faq, errors: [] });
  });
});
