import { describe, expect, it } from "vitest";
import { INTENTION_MIN_REPORTABLE, summariseIntentions, type IntentionSummaryRow } from "./intentionSummary";

const row = (over: Partial<IntentionSummaryRow> = {}): IntentionSummaryRow => ({
  booth_count: 1,
  frequency: "weekly",
  preferred_months: [],
  ...over,
});

const countOf = <K>(cells: { key: K; count: number | null }[], key: K) => cells.find((c) => c.key === key)?.count;

describe("summariseIntentions", () => {
  it("回答が最少人数に届かないときは、回答者数も全項目も伏せる", () => {
    const summary = summariseIntentions([row(), row({ booth_count: 2 })]);
    expect(summary.respondents).toBeNull();
    expect(summary.boothCounts.every((c) => c.count === null)).toBe(true);
    expect(summary.frequencies.every((c) => c.count === null)).toBe(true);
    expect(summary.months.every((c) => c.count === null)).toBe(true);
  });

  it("0件の回答では回答者数 0 を返す（伏せるのは1〜2件だけ）", () => {
    const summary = summariseIntentions([]);
    expect(summary.respondents).toBeNull();
  });

  it("十分な人数では区画数・頻度・月を数える", () => {
    const rows = [
      row({ booth_count: 1, frequency: "weekly", preferred_months: [3, 4] }),
      row({ booth_count: 1, frequency: "weekly", preferred_months: [4] }),
      row({ booth_count: 2, frequency: "monthly", preferred_months: [] }),
      row({ booth_count: 1, frequency: "undecided", preferred_months: [4, 4] }),
      row({ booth_count: 3, frequency: "weekly", preferred_months: [4] }),
    ];
    const summary = summariseIntentions(rows);
    expect(summary.respondents).toBe(5);
    // 1区画は3件、2区画と3区画は1件ずつ（最少人数未満の2つが伏せられる）
    expect(countOf(summary.boothCounts, 1)).toBe(3);
    expect(countOf(summary.boothCounts, 2)).toBeNull();
    expect(countOf(summary.boothCounts, 3)).toBeNull();
    expect(countOf(summary.frequencies, "weekly")).toBe(3);
    // 同じ人が同じ月を2回選んでも1回として数える
    expect(countOf(summary.months, 4)).toBe(4);
    // 3月は1件（最少人数未満）なので伏せる。12月は0件なので伏せない
    expect(countOf(summary.months, 3)).toBeNull();
    expect(countOf(summary.months, 12)).toBe(0);
  });

  it("件数が最少人数未満の項目は伏せる（0件は伏せない）", () => {
    const rows = [
      ...Array.from({ length: 4 }, () => row({ booth_count: 1 })),
      row({ booth_count: 2 }),
      row({ booth_count: 2 }),
    ];
    const summary = summariseIntentions(rows);
    // 2区画は2件（最少人数未満）。伏せたのが1つだけになるので、合計から逆算されないよう1区画（4件）も伏せる
    expect(countOf(summary.boothCounts, 2)).toBeNull();
    expect(countOf(summary.boothCounts, 1)).toBeNull();
    // 0件の3区画は伏せない
    expect(countOf(summary.boothCounts, 3)).toBe(0);
  });

  it("伏せた項目が1つだけなら、いちばん小さい項目も伏せて合計から逆算させない", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({ frequency: "weekly" })),
      ...Array.from({ length: 4 }, () => row({ frequency: "monthly" })),
      row({ frequency: "seasonal" }),
      row({ frequency: "seasonal" }),
      row({ frequency: "undecided" }),
    ];
    const summary = summariseIntentions(rows);
    // undecided(1)・seasonal(2)のうち、伏せるのは2つ（残る項目から合計が求まらない）
    const hidden = summary.frequencies.filter((c) => c.count === null).map((c) => c.key);
    expect(hidden).toEqual(expect.arrayContaining(["undecided", "seasonal"]));
    expect(countOf(summary.frequencies, "weekly")).toBe(5);
    expect(countOf(summary.frequencies, "monthly")).toBe(4);
  });

  it("月の件数は最少人数未満だけ伏せる", () => {
    const rows = [
      row({ preferred_months: [5] }),
      row({ preferred_months: [5, 6] }),
      row({ preferred_months: [5] }),
    ];
    const summary = summariseIntentions(rows);
    expect(countOf(summary.months, 5)).toBe(3);
    expect(countOf(summary.months, 6)).toBeNull();
    expect(INTENTION_MIN_REPORTABLE).toBe(3);
  });

  it("集計に店舗の情報や、ひとことは含まれない", () => {
    const summary = summariseIntentions([row({ frequency: "weekly" }), row(), row()]);
    const json = JSON.stringify(summary);
    expect(json).not.toMatch(/vendor|note|shop/i);
  });
});
