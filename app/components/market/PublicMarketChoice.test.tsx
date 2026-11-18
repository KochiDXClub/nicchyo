import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicMarketChoice from "./PublicMarketChoice";
import TodayMarketNotice from "./TodayMarketNotice";

const sunday = { id: "1", slug: "nichiyo", name: "日曜市", weekday: 0 };
const thursday = { id: "2", slug: "mokuyo", name: "木曜市", weekday: 4 };
// 2026-11-19 は木曜（JST）
const thursdayNoon = new Date("2026-11-19T03:00:00Z");

describe("PublicMarketChoice", () => {
  it("公開中の市が日曜市だけのときは何も出さない（日曜市の表示を変えない）", () => {
    const { container } = render(<PublicMarketChoice markets={[sunday]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("市が2つ以上公開されていると、市ごとに地図への導線を出す", () => {
    render(<PublicMarketChoice markets={[sunday, thursday]} />);
    expect(screen.getByText("木曜市")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "地図で見る" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/map?market=nichiyo", "/map?market=mokuyo"]);
  });
});

describe("TodayMarketNotice", () => {
  it("日曜市だけのときは、今日が日曜でも何も出さない", () => {
    const { container } = render(<TodayMarketNotice markets={[sunday]} now={new Date("2026-11-22T03:00:00Z")} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("2つ以上公開中で今日が木曜なら、木曜市を今日の市として出す", () => {
    render(<TodayMarketNotice markets={[sunday, thursday]} now={thursdayNoon} />);
    expect(screen.getByRole("link", { name: "木曜市" }).getAttribute("href")).toBe("/map?market=mokuyo");
  });

  it("今日開催の市がなければ何も出さない", () => {
    const { container } = render(<TodayMarketNotice markets={[sunday, thursday]} now={new Date("2026-11-20T03:00:00Z")} />);
    expect(container).toBeEmptyDOMElement();
  });
});
