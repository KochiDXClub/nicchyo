import { describe, expect, it } from "vitest";
import { VENDOR_INQUIRY_STATUS_BY_TOPIC } from "./constants";
import { REPORT_PATTERNS, buildReportBody, findReportPattern, statusLabel } from "./labels";

describe("buildReportBody", () => {
  const lastDay = findReportPattern("last_day")!;

  it("パターン名を見出しにして、入力値を項目ごとに並べる", () => {
    const body = buildReportBody(lastDay, { last_date: "2026-10-25", reason: "高齢のため" }, "");
    expect(body).toBe("【出店を最後にする】\n最終出店予定日: 2026-10-25\n理由: 高齢のため");
  });

  it("ラベルの注釈（括弧）は見出しから外す", () => {
    const body = buildReportBody(lastDay, { last_date: "2026-10-25", reason: "体調" }, "");
    // 「理由（任意）」ではなく「理由」になる
    expect(body).toContain("理由: 体調");
    expect(body).not.toContain("（任意）");
  });

  it("未入力の項目は行ごと出さない", () => {
    const body = buildReportBody(lastDay, { last_date: "2026-10-25", reason: "   " }, "");
    expect(body).toBe("【出店を最後にする】\n最終出店予定日: 2026-10-25");
  });

  it("補足があれば空行を挟んで後ろに付ける", () => {
    const body = buildReportBody(lastDay, { last_date: "2026-10-25" }, "長い間ありがとうございました");
    expect(body).toBe("【出店を最後にする】\n最終出店予定日: 2026-10-25\n\n長い間ありがとうございました");
  });

  it("入力欄が無いパターンでも見出しだけは残る", () => {
    const other = findReportPattern("other")!;
    expect(buildReportBody(other, {}, "")).toBe("【その他の報告】");
    expect(buildReportBody(other, {}, "駐車場について")).toBe("【その他の報告】\n\n駐車場について");
  });
});

describe("REPORT_PATTERNS", () => {
  it("idが重複していない", () => {
    const ids = REPORT_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("statusLabel", () => {
  // DBのCHECK制約が許すstatusは、すべて画面に出せる言葉を持っていること
  it.each(Object.values(VENDOR_INQUIRY_STATUS_BY_TOPIC).flat())("%s に表示ラベルがある", (status) => {
    expect(statusLabel(status).label).not.toBe(status);
  });

  it("未知のstatusでも落ちずにそのまま返す", () => {
    expect(statusLabel("unknown_status").label).toBe("unknown_status");
  });
});
