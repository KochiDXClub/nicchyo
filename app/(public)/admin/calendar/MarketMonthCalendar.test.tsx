import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MarketMonthCalendar from "./MarketMonthCalendar";
import type { MarketEvent } from "@/app/api/admin/events/route";

const event = {
  id: "e1",
  title: "文旦フェア",
  description: null,
  event_date: "2026-12-06",
  end_date: null,
  start_time: "10:00:00",
  end_time: null,
  location: null,
  category: "event",
  image_url: null,
  highlight_dates: [],
  is_published: true,
} as unknown as MarketEvent;

describe("MarketMonthCalendar", () => {
  beforeEach(() => {
    // 12月の表示になるよう、今日を12/1 にそろえる（日付判定を固定する）
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-01T03:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("予定の件数と中止の日を文字で示し、タップで予定を見せる", () => {
    const onOpenDay = vi.fn();
    render(
      <MarketMonthCalendar
        events={[event]}
        days={[{ market_date: "2026-12-13", status: "cancelled" }]}
        onOpenDay={onOpenDay}
      />
    );

    expect(screen.getByText("2026年12月")).toBeTruthy();
    expect(screen.getByRole("button", { name: /12\/6（日）、開催、予定1件/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /12\/13（日）、荒天中止/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /12\/6（日）、開催、予定1件/ }));
    expect(screen.getByText("文旦フェア")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "この日のカードを開く" }));
    expect(onOpenDay).toHaveBeenCalledWith("2026-12-06");
  });

  it("月を切り替えられる", () => {
    render(<MarketMonthCalendar events={[]} days={[]} onOpenDay={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "次の月" }));
    expect(screen.getByText("2027年1月")).toBeTruthy();
  });
});
