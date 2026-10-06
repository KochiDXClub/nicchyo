import { describe, expect, it } from "vitest";
import { describeChange, hourlyCounts, peakHour, sourceShares } from "./analyticsSummary";

// 時刻は端末の時刻で数えるので、端末の時刻のまま作る
const at = (hour: number) => new Date(2026, 9, 4, hour, 30).toISOString();

describe("hourlyCounts", () => {
  it("6〜15時を基本に、1時間ごとに閲覧を数える", () => {
    const hourly = hourlyCounts([
      { viewed_at: at(9), source: "map" },
      { viewed_at: at(9), source: "search" },
      { viewed_at: at(11), source: null },
    ]);
    expect(hourly[0].hour).toBe(6);
    expect(hourly[hourly.length - 1].hour).toBe(15);
    expect(hourly.find((h) => h.hour === 9)?.views).toBe(2);
    expect(hourly.find((h) => h.hour === 11)?.views).toBe(1);
  });

  it("範囲の外に閲覧があれば、そこまで広げる", () => {
    const hourly = hourlyCounts([{ viewed_at: at(4), source: "map" }, { viewed_at: at(18), source: "map" }]);
    expect(hourly[0]).toEqual({ hour: 4, views: 1 });
    expect(hourly[hourly.length - 1]).toEqual({ hour: 18, views: 1 });
  });
});

describe("peakHour", () => {
  it("いちばん多い時間を返し、同数なら早いほう。閲覧が無ければ null", () => {
    expect(peakHour([{ hour: 8, views: 2 }, { hour: 9, views: 5 }, { hour: 10, views: 5 }])).toEqual({ hour: 9, views: 5 });
    expect(peakHour([{ hour: 8, views: 0 }])).toBeNull();
  });
});

describe("sourceShares", () => {
  it("流入元ごとに数え、知らない値や空は direct にする", () => {
    expect(
      sourceShares([
        { viewed_at: at(9), source: "map" },
        { viewed_at: at(9), source: "search" },
        { viewed_at: at(9), source: null },
        { viewed_at: at(9), source: "other" },
      ])
    ).toEqual({ map: 1, search: 1, direct: 2 });
  });
});

describe("describeChange", () => {
  it("先週との差を一言にする。先週が 0 のときは割合を出さない", () => {
    expect(describeChange(12, 8)).toBe("先週より 4回多いです");
    expect(describeChange(5, 8)).toBe("先週より 3回少ないです");
    expect(describeChange(8, 8)).toBe("先週と同じです");
    expect(describeChange(3, 0)).toBe("先週は 0回でした");
    expect(describeChange(0, 0)).toBe("先週もまだ記録がありません");
  });
});
