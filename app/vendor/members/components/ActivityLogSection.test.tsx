import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import ActivityLogSection from "./ActivityLogSection";

const fetchActivityLogs = vi.fn();
vi.mock("../../_services/membersService", () => ({ fetchActivityLogs: (...args: unknown[]) => fetchActivityLogs(...args) }));

const log = (id: number, summary: string, createdAt: string) => ({
  id,
  actorName: "山田",
  action: "invite.create",
  label: "招待リンクを作った",
  summary,
  createdAt,
});

beforeEach(() => vi.clearAllMocks());

describe("ActivityLogSection", () => {
  it("操作ログを新しい順に出す。誰が・いつ・何をしたか", async () => {
    fetchActivityLogs.mockResolvedValue({ logs: [log(2, "招待リンクを作った（3人まで）", "2026-10-03T05:00:00Z")], hasMore: false });
    render(<ActivityLogSection />);

    expect(await screen.findByText("招待リンクを作った（3人まで）")).toBeInTheDocument();
    expect(screen.getByText(/山田/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument();
  });

  it("続きがあれば「もっと見る」で、最後の記録より古い分を足す", async () => {
    fetchActivityLogs
      .mockResolvedValueOnce({ logs: [log(2, "新しい記録", "2026-10-03T05:00:00Z")], hasMore: true })
      .mockResolvedValueOnce({ logs: [log(1, "古い記録", "2026-10-01T05:00:00Z")], hasMore: false });
    render(<ActivityLogSection />);

    fireEvent.click(await screen.findByRole("button", { name: "もっと見る" }));

    expect(await screen.findByText("古い記録")).toBeInTheDocument();
    expect(screen.getByText("新しい記録")).toBeInTheDocument();
    expect(fetchActivityLogs).toHaveBeenLastCalledWith("2026-10-03T05:00:00Z");
    await waitFor(() => expect(screen.queryByRole("button", { name: "もっと見る" })).not.toBeInTheDocument());
  });

  it("記録がなければそう伝え、読めなかったら理由を出す", async () => {
    fetchActivityLogs.mockResolvedValueOnce({ logs: [], hasMore: false });
    const { unmount } = render(<ActivityLogSection />);
    expect(await screen.findByText("まだ記録はありません")).toBeInTheDocument();
    unmount();

    fetchActivityLogs.mockRejectedValueOnce(new Error("操作ログを読み込めませんでした"));
    render(<ActivityLogSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent("操作ログを読み込めませんでした");
  });
});
