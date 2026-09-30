import { describe, expect, it } from "vitest";
import { compareSnapshots } from "./compareSnapshots";
import type { SnapshotSummary } from "./types";

function summary(overrides: Partial<SnapshotSummary["metrics"]> = {}, ruleValue = 0): SnapshotSummary {
  return {
    label: "test",
    generatedAt: "2026-01-01T00:00:00.000Z",
    totals: {
      files: 100,
      lines: 10000,
      productLines: 8000,
      sharedLines: 2000,
      duplicatedLines: 100,
      significantLines: 5000,
      byKind: {},
      byRole: {},
    },
    metrics: {
      sharedRatio: 25,
      duplicationRatio: 2,
      largeFiles: 5,
      sameNameComponents: 0,
      ...overrides,
    },
    rules: {
      rawHex: { value: ruleValue, matches: ruleValue, fileCount: ruleValue, files: [] },
      neutralPalette: { value: 0, matches: 0, fileCount: 0, files: [] },
      rawRounded: { value: 0, matches: 0, fileCount: 0, files: [] },
      gradients: { value: 0, matches: 0, fileCount: 0, files: [] },
      adhocModal: { value: 0, matches: 0, fileCount: 0, files: [] },
      directSupabaseClient: { value: 0, matches: 0, fileCount: 0, files: [] },
      inlineAdminCheck: { value: 0, matches: 0, fileCount: 0, files: [] },
      inlineCacheControl: { value: 0, matches: 0, fileCount: 0, files: [] },
      useClientInUi: { value: 0, matches: 0, fileCount: 0, files: [] },
      consoleLog: { value: 0, matches: 0, fileCount: 0, files: [] },
    },
    clones: [],
    sameName: [],
    largeFiles: [],
  };
}

describe("compareSnapshots", () => {
  it("前回が無ければ null を返す", () => {
    expect(compareSnapshots(null, summary())).toBeNull();
  });

  it("共通化率（higher が良い）が上がったら better", () => {
    const result = compareSnapshots(summary({ sharedRatio: 20 }), summary({ sharedRatio: 30 }));
    const sharedRatio = result?.metrics.find((m) => m.id === "sharedRatio");
    expect(sharedRatio?.direction).toBe("better");
    expect(sharedRatio?.before).toBe(20);
    expect(sharedRatio?.after).toBe(30);
  });

  it("コピペ率（lower が良い）が上がったら worse", () => {
    const result = compareSnapshots(summary({ duplicationRatio: 2 }), summary({ duplicationRatio: 5 }));
    const duplicationRatio = result?.metrics.find((m) => m.id === "duplicationRatio");
    expect(duplicationRatio?.direction).toBe("worse");
  });

  it("値が変わらなければ same", () => {
    const result = compareSnapshots(summary(), summary());
    expect(result?.metrics.every((m) => m.direction === "same")).toBe(true);
    expect(result?.rules.every((r) => r.direction === "same")).toBe(true);
  });

  it("ルール違反が減れば better、増えれば worse", () => {
    const improved = compareSnapshots(summary({}, 10), summary({}, 3));
    expect(improved?.rules.find((r) => r.id === "rawHex")?.direction).toBe("better");

    const worsened = compareSnapshots(summary({}, 3), summary({}, 10));
    expect(worsened?.rules.find((r) => r.id === "rawHex")?.direction).toBe("worse");
  });

  it("ファイル数・行数の差分を計算する", () => {
    const before = summary();
    const after = summary();
    after.totals.files = 105;
    after.totals.lines = 10500;
    const result = compareSnapshots(before, after);
    expect(result?.filesDelta).toBe(5);
    expect(result?.linesDelta).toBe(500);
  });
});
