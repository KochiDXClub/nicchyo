import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { groupEventsBySunday } from "@/lib/market/calendar";
import UpcomingSundays from "./UpcomingSundays";

it("運営の登録がある日だけに取得した更新時刻を表示する", () => {
  const updatedAt = "2026-11-18T04:15:00Z";
  const sundays = groupEventsBySunday([], [
    { market_date: "2026-11-22", status: "cancelled", note: "荒天のため", updated_at: updatedAt },
  ], 2, new Date(updatedAt));
  render(<UpcomingSundays sundays={sundays} showStatusSource />);

  const [registered, regular] = screen.getAllByRole("listitem");
  expect(within(registered).getByText("荒天中止")).toBeInTheDocument();
  expect(registered).toHaveTextContent("運営が登録");
  expect(registered.querySelector("time")).toHaveAttribute("datetime", updatedAt);
  expect(registered.querySelector("time")).toHaveTextContent("13:15");
  expect(within(regular).getByText("通常予定")).toBeInTheDocument();
  expect(regular.querySelector("time")).toBeNull();
});
