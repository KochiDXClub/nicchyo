import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VendorAnalyticsPage from "./page";

const fetchShopViews = vi.fn();
const fetchAiConsultAnalytics = vi.fn();
const fetchVendorHeartSummary = vi.fn();
const fetchMyProductNames = vi.fn();
const fetchProductSearchTrends = vi.fn();

// 本物と同じく、描き直しても同じ user を返す
const AUTH = { user: { id: "v1" } };
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => AUTH }));
vi.mock("../_services/analyticsService", () => ({
  fetchShopViews: (...args: unknown[]) => fetchShopViews(...args),
  fetchAiConsultAnalytics: (...args: unknown[]) => fetchAiConsultAnalytics(...args),
  fetchVendorHeartSummary: (...args: unknown[]) => fetchVendorHeartSummary(...args),
  fetchMyProductNames: (...args: unknown[]) => fetchMyProductNames(...args),
  fetchProductSearchTrends: (...args: unknown[]) => fetchProductSearchTrends(...args),
}));

const hourly = (views: Record<number, number>) =>
  Array.from({ length: 10 }, (_, i) => ({ hour: 6 + i, views: views[6 + i] ?? 0 }));

async function renderPage() {
  await act(async () => {
    render(<VendorAnalyticsPage />);
  });
}

describe("お店の分析", () => {
  beforeEach(() => {
    fetchShopViews.mockReset().mockResolvedValue({ thisWeek: 0, lastWeek: 0, hourly: hourly({}), sources: { map: 0, search: 0, direct: 0 }, sampled: false });
    fetchAiConsultAnalytics.mockReset().mockResolvedValue({ topics: [], keywords: [], recommendationCount: 0, totalCount: 0 });
    fetchVendorHeartSummary.mockReset().mockResolvedValue({ total: 0, thisWeek: 0 });
    fetchMyProductNames.mockReset().mockResolvedValue(["トマト"]);
    fetchProductSearchTrends.mockReset().mockResolvedValue([]);
  });

  it("まだ数字が無いときは、案内を出して、時間帯・流入元の欄は出さない", async () => {
    await renderPage();
    expect(screen.getByText(/まだ数字がないき/)).toBeInTheDocument();
    expect(screen.queryByText("いつ、どこから見られた？")).not.toBeInTheDocument();
  });

  it("見られた回数・先週との差・いちばん見られた時間・探されているもの（自分の商品に印）を出す", async () => {
    fetchShopViews.mockResolvedValue({
      thisWeek: 12,
      lastWeek: 8,
      hourly: hourly({ 9: 7, 10: 5 }),
      sources: { map: 8, search: 3, direct: 1 },
      sampled: false,
    });
    fetchProductSearchTrends.mockResolvedValue([{ keyword: "トマト", count: 4, matchesMyProducts: true }]);
    await renderPage();

    expect(screen.getByText("先週より 4回多いです")).toBeInTheDocument();
    expect(screen.getByText(/9時台が、いちばん見られちょります/)).toBeInTheDocument();
    expect(screen.getByText("地図から")).toBeInTheDocument();
    expect(screen.getByText("お店にある")).toBeInTheDocument();
    expect(fetchProductSearchTrends).toHaveBeenCalledWith(["トマト"]);
  });

  it("見られた回数が多くて、時間帯・流入元が一部の行からの数のときは、そう書く", async () => {
    fetchShopViews.mockResolvedValue({
      thisWeek: 1500,
      lastWeek: 1200,
      hourly: hourly({ 9: 600, 10: 400 }),
      sources: { map: 800, search: 150, direct: 50 },
      sampled: true,
    });
    await renderPage();
    expect(screen.getByText(/直近の1000回から数えています/)).toBeInTheDocument();
  });

  it("相談の数が取れなかったときは、0 にせず「読めんかった」を出す", async () => {
    fetchAiConsultAnalytics.mockRejectedValue(new Error("network"));
    await renderPage();
    expect(screen.getByText(/お客さんの相談を読めんかった/)).toBeInTheDocument();
  });
});
