import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VENDOR_FAQ } from "@/lib/vendor/helpFaq";
import VendorFaqClient from "./VendorFaqClient";

describe("VendorFaqClient", () => {
  it("質問を一覧で出し、押すと答えと画面へのリンクが開く", () => {
    render(<VendorFaqClient />);
    const item = VENDOR_FAQ.find((faq) => faq.id === "post-again")!;

    expect(screen.queryByText(item.a)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: item.q }));

    expect(screen.getByText(item.a)).toBeTruthy();
    expect(screen.getByRole("link", { name: "近況投稿ページを開く" }).getAttribute("href")).toBe("/vendor/posts");
  });

  it("キーワードで絞り込み、合うものが無ければそう伝える", () => {
    render(<VendorFaqClient />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "雨の日" } });
    expect(screen.getByRole("button", { name: /雨の日は出ない場合/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /近況はどうやって出しますか/ })).toBeNull();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzzzz" } });
    expect(screen.getByText("合う質問が見つかりませんでした")).toBeTruthy();
  });

  it("カテゴリで絞り込める", () => {
    render(<VendorFaqClient />);

    fireEvent.click(screen.getByRole("button", { name: "数字" }));
    expect(screen.getByRole("button", { name: /どう数えていますか/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /最初に何をしたら/ })).toBeNull();
  });
});
