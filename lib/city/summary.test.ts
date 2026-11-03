import { describe, expect, it } from "vitest";
import { summariseMarketDays, summariseVisitors } from "./summary";

describe("summariseVisitors", () => {
  const today = "2026-11-03";

  it("直近28日（今日を含む）だけを合計し、記録のある日で平均する", () => {
    const rows = [
      { visit_date: "2026-11-03", visitor_count: 100 },
      { visit_date: "2026-10-07", visitor_count: 50 }, // 28日目（含む）
      { visit_date: "2026-10-06", visitor_count: 999 }, // 29日前（含まない）
      { visit_date: "2026-11-04", visitor_count: 999 }, // 未来（含まない）
    ];
    expect(summariseVisitors(rows, today)).toEqual({ total28: 150, average28: 75, recordedDays: 2 });
  });

  it("記録が無ければ null", () => {
    expect(summariseVisitors([], today)).toBeNull();
    expect(summariseVisitors([{ visit_date: "2025-01-01", visitor_count: 5 }], today)).toBeNull();
  });

  it("人数が欠けた行は 0 として数える", () => {
    expect(summariseVisitors([{ visit_date: "2026-11-01", visitor_count: null }], today)).toEqual({
      total28: 0,
      average28: 0,
      recordedDays: 1,
    });
  });
});

describe("summariseMarketDays", () => {
  it("今日より先の日付（予定）は実績に数えない。今日は含む", () => {
    const rows = [
      { market_date: "2026-11-01", status: "open" },
      { market_date: "2026-11-03", status: "cancelled" },
      { market_date: "2026-11-08", status: "cancelled" },
    ];
    expect(summariseMarketDays(rows, 2026, "2026-11-03")).toEqual({
      open: 1,
      cancelled: 1,
      special: 0,
      closed: 0,
    });
  });

  it("記録が1件も無ければ null（0回と区別する）", () => {
    expect(summariseMarketDays([], 2026, "2026-12-31")).toBeNull();
    expect(
      summariseMarketDays([{ market_date: "2026-11-08", status: "open" }], 2026, "2026-11-03")
    ).toBeNull();
    expect(
      summariseMarketDays([{ market_date: "2025-11-02", status: "open" }], 2026, "2026-12-31")
    ).toBeNull();
  });

  it("その年のステータスごとの回数を数える（未知のステータスは無視）", () => {
    const rows = [
      { market_date: "2026-01-04", status: "open" },
      { market_date: "2026-01-11", status: "open" },
      { market_date: "2026-01-18", status: "cancelled" },
      { market_date: "2026-01-25", status: "mystery" },
      { market_date: "2025-12-28", status: "closed" },
    ];
    expect(summariseMarketDays(rows, 2026, "2026-12-31")).toEqual({ open: 2, cancelled: 1, special: 0, closed: 0 });
  });
});
