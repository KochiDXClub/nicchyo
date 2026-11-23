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
  // 登録のない日は札を出さず、本文で「開催予定」とだけ伝える
  expect(within(regular).getByText("開催予定")).toBeInTheDocument();
  expect(regular.querySelector("time")).toBeNull();
});

it("複数の市では行に市の名前を出し、絞り込み中は省く", () => {
  const dates = getMarketCalendarDates({
    todayIso: "2026-11-18",
    markets: [
      { id: "sunday", slug: "nichiyo", name: "日曜市", weekday: 0, events: [], days: [] },
      { id: "thursday", slug: "mokuyo", name: "木曜市", weekday: 4, events: [], days: [] },
    ],
  }, 1);
  const { rerender } = render(<UpcomingMarketDates dates={dates} />);
  expect(screen.getByText("木曜市")).toBeInTheDocument();
  expect(screen.getByText("日曜市")).toBeInTheDocument();
  // 平常の日は「開催」「通常予定」の札を行ごとに並べない
  expect(screen.queryByText("通常予定")).toBeNull();

  rerender(<UpcomingMarketDates dates={dates.filter((date) => date.marketId === "thursday")} showMarketName={false} />);
  expect(screen.queryByText("木曜市")).toBeNull();
  expect(screen.getByText("開催予定")).toBeInTheDocument();
});
