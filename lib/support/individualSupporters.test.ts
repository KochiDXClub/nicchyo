import { describe, it, expect } from "vitest";
import {
  formatMonth,
  formatSince,
  groupSupportersByYear,
  sortedIndividualSupporters,
  totalIndividualSupporters,
  type IndividualSupporter,
} from "./individualSupporters";

function s(name: string, since: string): IndividualSupporter {
  return { name, since };
}

describe("sortedIndividualSupporters", () => {
  it("新しい順に並べる", () => {
    const sorted = sortedIndividualSupporters([
      s("A", "2026-03"),
      s("B", "2027-01"),
      s("C", "2026-11"),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(["B", "C", "A"]);
  });

  it("元の配列を書き換えない", () => {
    const input = [s("A", "2026-03"), s("B", "2027-01")];
    sortedIndividualSupporters(input);
    expect(input.map((x) => x.name)).toEqual(["A", "B"]);
  });
});

describe("groupSupportersByYear", () => {
  it("年ごとにまとめ、新しい年を先に置く", () => {
    const groups = groupSupportersByYear([
      s("A", "2026-03"),
      s("B", "2027-01"),
      s("C", "2026-11"),
    ]);
    expect(groups.map((g) => g.year)).toEqual(["2027", "2026"]);
    expect(groups[1].supporters.map((x) => x.name)).toEqual(["C", "A"]);
  });

  it("同じ年が離れて入っていても、1つのまとまりにする", () => {
    const groups = groupSupportersByYear([
      s("A", "2026-01"),
      s("B", "2027-05"),
      s("C", "2026-08"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.year === "2026")?.supporters).toHaveLength(2);
  });

  it("誰もいなければ空", () => {
    expect(groupSupportersByYear([])).toEqual([]);
  });
});

describe("totalIndividualSupporters", () => {
  // 掲載を希望されなかった方も、人数には数える
  it("掲載しているお名前と匿名の方を足す", () => {
    expect(totalIndividualSupporters([s("A", "2026-01")], 3)).toBe(4);
  });
});

describe("formatSince / formatMonth", () => {
  it("年月と、月だけをそれぞれ出す", () => {
    expect(formatSince("2026-09")).toBe("2026年9月");
    expect(formatMonth("2026-09")).toBe("9月");
  });

  it("読めない形でも落ちない", () => {
    expect(formatSince("2026")).toBe("2026");
    expect(formatMonth("2026")).toBe("");
  });
});
