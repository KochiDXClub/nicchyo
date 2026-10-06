import { describe, expect, it } from "vitest";
import { formatTime, isEndAfterStart, parseTime, TIME_OPTIONS, timeToMinutes } from "./businessHours";

describe("TIME_OPTIONS", () => {
  it("5:00 から 24:00 まで、10分刻み（24:00 は夜中の0時の1つだけ）", () => {
    expect(TIME_OPTIONS[0]).toBe("5:00");
    expect(TIME_OPTIONS[1]).toBe("5:10");
    expect(TIME_OPTIONS).toContain("7:30");
    expect(TIME_OPTIONS).toContain("23:50");
    expect(TIME_OPTIONS.at(-1)).toBe("24:00");
    expect(TIME_OPTIONS).not.toContain("24:10");
    expect(TIME_OPTIONS).not.toContain("4:50");
    expect(TIME_OPTIONS).toHaveLength(19 * 6 + 1);
  });

  it("これまでの「何時ちょうど」の値は、そのまま選べる", () => {
    for (let h = 5; h <= 24; h++) expect(TIME_OPTIONS).toContain(`${h}:00`);
  });
});

describe("formatTime / parseTime", () => {
  it("分は2けたにそろえる（保存の形は H:MM）", () => {
    expect(formatTime(7)).toBe("7:00");
    expect(formatTime(7, 5)).toBe("7:05");
    expect(formatTime(13, 30)).toBe("13:30");
  });

  it("選べる時刻だけ読める。10分刻みでない・範囲外・形式違い・空は null", () => {
    expect(parseTime("7:30")).toEqual({ hour: 7, minute: 30 });
    expect(parseTime(" 24:00 ")).toEqual({ hour: 24, minute: 0 });
    expect(parseTime("7:35")).toBeNull();
    expect(parseTime("4:00")).toBeNull();
    expect(parseTime("24:10")).toBeNull();
    expect(parseTime("7時")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime(undefined)).toBeNull();
  });

  it("分に直せる", () => {
    expect(timeToMinutes("7:30")).toBe(450);
    expect(timeToMinutes("x")).toBeNull();
  });
});

describe("isEndAfterStart", () => {
  it("終わりが始まりより後のときだけ true（同じ時刻・前・読めない値は false）", () => {
    expect(isEndAfterStart("7:00", "7:10")).toBe(true);
    expect(isEndAfterStart("7:30", "13:00")).toBe(true);
    expect(isEndAfterStart("7:00", "7:00")).toBe(false);
    expect(isEndAfterStart("13:00", "7:30")).toBe(false);
    expect(isEndAfterStart("7:00", "")).toBe(false);
    expect(isEndAfterStart("7:05", "9:00")).toBe(false);
  });
});
