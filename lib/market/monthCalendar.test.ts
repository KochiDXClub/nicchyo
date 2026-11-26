import { describe, expect, it } from "vitest";
import { buildMonthGrid, getMonthDayInfo, shiftMonth, toneForStatus } from "./monthCalendar";
import type { MarketDay, MarketEvent } from "./calendar";

const baseEvent: MarketEvent = {
  id: "e1",
  title: "文旦フェア",
  description: null,
  event_date: "2026-12-06",
  end_date: null,
  start_time: null,
  end_time: null,
  location: null,
  category: "event",
  image_url: null,
  highlight_dates: [],
};

describe("buildMonthGrid", () => {
  it("2026年12月は火曜始まりなので、日曜から始まる週を作る", () => {
    const weeks = buildMonthGrid(2026, 12);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // 12/1 は火曜。先頭の日曜は 11/29
    expect(weeks[0][0].dateIso).toBe("2026-11-29");
    expect(weeks[0][2].dateIso).toBe("2026-12-01");
    expect(weeks[0][2].inMonth).toBe(true);
    expect(weeks[0][1].inMonth).toBe(false);
    expect(weeks[0][0].inMonth).toBe(false);
    const last = weeks[weeks.length - 1];
    expect(last.some((c) => c.dateIso === "2026-12-31" && c.inMonth)).toBe(true);
  });

  it("各週の0列目（日曜）だけが開催日になる", () => {
    const weeks = buildMonthGrid(2026, 12);
    const marketDays = weeks.flat().filter((c) => c.isMarketDay).map((c) => c.dateIso);
    expect(marketDays[0]).toBe("2026-11-29");
    expect(marketDays.every((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0)).toBe(true);
  });
});

describe("shiftMonth", () => {
  it("年をまたいで前後に移動する", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe("toneForStatus", () => {
  it("開催日以外は色を付けない", () => {
    expect(toneForStatus("cancelled", false)).toBe("none");
  });
  it("中止・休市は赤系、特別開催は強調、平常は淡く塗る", () => {
    expect(toneForStatus("cancelled", true)).toBe("alert");
    expect(toneForStatus("closed", true)).toBe("alert");
    expect(toneForStatus("special", true)).toBe("highlight");
    expect(toneForStatus("open", true)).toBe("open");
  });
});

describe("getMonthDayInfo", () => {
  it("日曜で行が無ければ平常開催として扱う", () => {
    const info = getMonthDayInfo("2026-12-06", [], []);
    expect(info.tone).toBe("open");
    expect(info.status).toBe("open");
  });

  it("中止の行がある日曜は alert になる", () => {
    const days: MarketDay[] = [{ market_date: "2026-12-06", status: "cancelled", note: null }];
    expect(getMonthDayInfo("2026-12-06", [], days).tone).toBe("alert");
  });

  it("日曜以外の日は予定があっても開催情報を持たない", () => {
    const info = getMonthDayInfo("2026-12-07", [baseEvent], []);
    expect(info.isMarketDay).toBe(false);
    expect(info.events).toEqual([]);
  });

  it("予定は一覧と同じ規則でその日曜に振り分けられる", () => {
    // 12/2（水）の予定は、その週の日曜 12/6 に載る
    const midweek = { ...baseEvent, id: "e2", event_date: "2026-12-02" };
    expect(getMonthDayInfo("2026-12-06", [baseEvent, midweek], []).events.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(getMonthDayInfo("2026-12-13", [baseEvent, midweek], []).events).toEqual([]);
  });
});
