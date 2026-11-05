import { render, screen } from "@testing-library/react";
import MarketStatusCalendar from "./MarketStatusCalendar";
import type { MarketDay } from "@/lib/market/calendar";

const day = (status: MarketDay["status"]): MarketDay => ({
  market_date: "2026-11-08",
  status,
  note: null,
});

describe("MarketStatusCalendar", () => {
  it("重複する案内を省いても中止は目立つ形で表示する", () => {
    render(<MarketStatusCalendar day={day("cancelled")} showSummary={false} />);
    const notice = screen.getByText("荒天中止", { selector: "p" });
    expect(notice).toHaveClass("bg-rose-500");
    expect(screen.queryByText("次の日曜市")).not.toBeInTheDocument();
  });

  it("通常開催では重複した開催情報を表示しない", () => {
    render(<MarketStatusCalendar day={day("open")} showSummary={false} />);
    expect(screen.queryByText("次の日曜市")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /開催/ })).toBeInTheDocument();
  });
});
