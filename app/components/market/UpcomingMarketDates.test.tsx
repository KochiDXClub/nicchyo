import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { getMarketCalendarDates } from "@/lib/market/calendar";
import UpcomingMarketDates from "./UpcomingMarketDates";

it("運営の登録がある日だけに取得した更新時刻を表示する", () => {
  const updatedAt = "2026-11-18T04:15:00Z";
  const dates = getMarketCalendarDates({
    todayIso: "2026-11-18",
    markets: [{
      id: "sunday", slug: "nichiyo", name: "日曜市", weekday: 0, events: [],
      days: [{ market_date: "2026-11-22", status: "cancelled", note: "荒天のため", updated_at: updatedAt }],
    }],
  }, 2);
  render(<UpcomingMarketDates dates={dates} showStatusSource />);

  const [registered, regular] = screen.getAllByRole("listitem");
  expect(within(registered).getByText("荒天中止")).toBeInTheDocument();
  expect(registered).toHaveTextContent("運営が登録");
  expect(registered.querySelector("time")).toHaveAttribute("datetime", updatedAt);
  expect(registered.querySelector("time")).toHaveTextContent("13:15");
  expect(within(regular).getByText("通常予定")).toBeInTheDocument();
  expect(regular.querySelector("time")).toBeNull();
});
