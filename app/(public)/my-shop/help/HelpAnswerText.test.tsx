import React from "react";
import { render, screen } from "@testing-library/react";
import HelpAnswerText, { splitHelpAnswer } from "./HelpAnswerText";

describe("splitHelpAnswer", () => {
  it("案内できる画面へのリンクは、名前をリンクの文字にする", () => {
    expect(splitHelpAnswer("写真は[店舗情報ページ](/vendor/store)で変えられるよ。")).toEqual([
      { type: "text", text: "写真は" },
      { type: "link", text: "店舗情報ページ", href: "/vendor/store" },
      { type: "text", text: "で変えられるよ。" },
    ]);
  });

  it("URL だけが書かれていても、画面の名前のリンクにする", () => {
    expect(splitHelpAnswer("/vendor/post/new から投稿してね")).toEqual([
      { type: "link", text: "近況投稿ページ", href: "/vendor/post/new" },
      { type: "text", text: " から投稿してね" },
    ]);
    expect(splitHelpAnswer("[/my-shop/schedule](/my-shop/schedule)")).toEqual([
      { type: "link", text: "出店カレンダーページ", href: "/my-shop/schedule" },
    ]);
  });

  it("一覧に無い URL や外のサイトはリンクにしない", () => {
    expect(splitHelpAnswer("[ここ](https://evil.example/vendor/store)を見て")).toEqual([
      { type: "text", text: "ここを見て" },
    ]);
    expect(splitHelpAnswer("[管理](/admin)")).toEqual([{ type: "text", text: "管理" }]);
    expect(splitHelpAnswer("[押して](javascript:alert)")).toEqual([{ type: "text", text: "押して" }]);
    expect(splitHelpAnswer("[店](//vendor/store)")).toEqual([{ type: "text", text: "店" }]);
    expect(splitHelpAnswer("/vendorfoo を見て")).toEqual([{ type: "text", text: "/vendorfoo を見て" }]);
    expect(splitHelpAnswer("https://example.com/vendor/store")).toEqual([
      { type: "text", text: "https://example.com/vendor/store" },
    ]);
  });

  it("書きかけのリンクは、かっこや URL を出さずに名前だけ出す", () => {
    expect(splitHelpAnswer("写真は[店舗情報ペ")).toEqual([{ type: "text", text: "写真は店舗情報ペ" }]);
    expect(splitHelpAnswer("写真は[店舗情報ページ](/vendor/st")).toEqual([
      { type: "text", text: "写真は店舗情報ページ" },
    ]);
  });
});

describe("HelpAnswerText", () => {
  it("画面の名前がリンクとして押せる", () => {
    render(<HelpAnswerText answer="[近況投稿ページ](/vendor/post/new)から投稿してや。" />);
    expect(screen.getByRole("link", { name: "近況投稿ページ" })).toHaveAttribute("href", "/vendor/post/new");
  });
});
