import { describe, it, expect } from "vitest";
import {
  toIsoDate,
  getUpcomingSundayIso,
  normalizeStatus,
  getStatusPresentation,
  shouldSurfaceOnMap,
  formatEventDate,
  formatEventTime,
} from "./calendar";

// 実行環境のタイムゾーンに左右されないよう、基準日は UTC の瞬時刻で書く。
// コメントの JST 表記が、その瞬間に高知で何日の何時かを示す。
describe("toIsoDate", () => {
  it("JST の暦日を YYYY-MM-DD にする", () => {
    // JST 2026-08-17 12:00
    expect(toIsoDate(new Date("2026-08-17T03:00:00Z"))).toBe("2026-08-17");
  });

  it("月日を0埋めする", () => {
    // JST 2026-01-05 09:00
    expect(toIsoDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("JST の深夜0時台が UTC の前日に倒れない", () => {
    // JST 2026-08-17 00:30（UTC ではまだ 08-16 15:30）
    expect(toIsoDate(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-17");
  });

  it("JST の23時台が翌日に繰り上がらない", () => {
    // JST 2026-08-16 23:30
    expect(toIsoDate(new Date("2026-08-16T14:30:00Z"))).toBe("2026-08-16");
  });
});

describe("getUpcomingSundayIso", () => {
  it("平日なら今週の日曜を返す", () => {
    // JST 2026-08-12（水）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-12T03:00:00Z"))).toBe("2026-08-16");
  });

  it("日曜当日はその日を返す", () => {
    // JST 2026-08-16（日）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-16T03:00:00Z"))).toBe("2026-08-16");
  });

  it("土曜なら翌日を返す", () => {
    // JST 2026-08-15（土）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-15T03:00:00Z"))).toBe("2026-08-16");
  });

  it("月曜の未明でも前日の日曜に戻らない", () => {
    // JST 2026-08-17（月）00:30。UTC ではまだ 08-16（日）なので、
    // サーバーのローカル時刻で判定すると過ぎたばかりの 08-16 を返してしまう。
    expect(getUpcomingSundayIso(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-23");
  });

  it("月をまたぐ場合も正しい日付になる", () => {
    // JST 2026-08-31（月）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-31T03:00:00Z"))).toBe("2026-09-06");
  });
});

describe("normalizeStatus", () => {
  it("既知のステータスはそのまま通す", () => {
    expect(normalizeStatus("cancelled")).toBe("cancelled");
    expect(normalizeStatus("special")).toBe("special");
    expect(normalizeStatus("closed")).toBe("closed");
  });

  it("想定外の値は open に倒す", () => {
    expect(normalizeStatus("unknown")).toBe("open");
    expect(normalizeStatus(null)).toBe("open");
    expect(normalizeStatus(undefined)).toBe("open");
    expect(normalizeStatus(123)).toBe("open");
  });
});

describe("getStatusPresentation", () => {
  it("中止・臨時休市は警戒色にする", () => {
    expect(getStatusPresentation("cancelled").tone).toBe("alert");
    expect(getStatusPresentation("closed").tone).toBe("alert");
  });

  it("通常開催は目立たせない", () => {
    expect(getStatusPresentation("open").tone).toBe("neutral");
  });

  it("特別開催はアクセント色にする", () => {
    expect(getStatusPresentation("special").tone).toBe("highlight");
  });
});

describe("shouldSurfaceOnMap", () => {
  it("通常開催のときはマップにバーを出さない", () => {
    expect(shouldSurfaceOnMap("open")).toBe(false);
  });

  it("例外のときだけマップにバーを出す", () => {
    expect(shouldSurfaceOnMap("cancelled")).toBe(true);
    expect(shouldSurfaceOnMap("closed")).toBe(true);
    expect(shouldSurfaceOnMap("special")).toBe(true);
  });
});

describe("formatEventDate", () => {
  it("曜日つきの表示にする", () => {
    expect(formatEventDate("2026-08-16")).toBe("8/16（日）");
  });

  it("0埋めを外して表示する", () => {
    expect(formatEventDate("2026-01-05")).toBe("1/5（月）");
  });

  it("壊れた入力はそのまま返す", () => {
    expect(formatEventDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatEventTime", () => {
  it("開始と終了があれば範囲にする", () => {
    expect(formatEventTime("10:00:00", "15:00:00")).toBe("10:00〜15:00");
  });

  it("開始だけなら開始〜にする", () => {
    expect(formatEventTime("10:00:00", null)).toBe("10:00〜");
  });

  it("終了だけなら〜終了にする", () => {
    expect(formatEventTime(null, "15:00:00")).toBe("〜15:00");
  });

  it("どちらも無ければ null", () => {
    expect(formatEventTime(null, null)).toBeNull();
  });
});
