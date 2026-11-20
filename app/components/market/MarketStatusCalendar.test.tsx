import { render, screen } from "@testing-library/react";
import MarketStatusCalendar from "./MarketStatusCalendar";
import type { MarketDay, MarketCalendarDate } from "@/lib/market/calendar";

const date = (status: MarketDay["status"]): MarketCalendarDate => ({
  marketId: "sun",
  dateIso: "2026-11-08",
  dateLabel: "11/8（日）",
  relativeLabel: "今週",
  isThisWeek: true,
  status,
  day: null,
  highlight: null,
  events: [],
});


describe("MarketStatusCalendar", () => {
  it("重複する案内を省いても中止は目立つ形で表示する", () => {
    render(<MarketStatusCalendar date={date("cancelled")} showSummary={false} />);
    const notice = screen.getByText("荒天中止", { selector: "p" });
    expect(notice).toHaveClass("bg-rose-500");
    expect(screen.queryByText("次の日曜市")).not.toBeInTheDocument();
  });

  it("市の名前があるときは、曜日の『日曜日』を重ねて書かない", () => {
    render(<MarketStatusCalendar date={{ ...date("open"), marketName: "日曜市" }} showSummary={false} />);
    expect(screen.getByText("日曜市")).toBeInTheDocument();
    expect(screen.queryByText("日曜日")).not.toBeInTheDocument();
  });

  it("通常開催では重複した開催情報を表示しない", () => {
    render(<MarketStatusCalendar date={date("open")} showSummary={false} />);
    expect(screen.queryByText("次の日曜市")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /開催/ })).toBeInTheDocument();
  });
});
