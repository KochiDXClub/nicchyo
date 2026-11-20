import { expect, it } from "vitest";
import { readAuditResult } from "./dependency-audit.mjs";

it("区別する: 正常な0件・指摘による終了コード1・取得失敗", () => {
  function read(status: number, vulnerabilities: object) {
    return readAuditResult({ status, stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities,
      metadata: { vulnerabilities: { total: Object.keys(vulnerabilities).length } } }) }, "today");
  }
  expect(read(0, {})).toMatchObject({ status: "complete", packages: [] });
  expect(read(1, { pkg: { name: "pkg", severity: "high", via: ["dep"], fixAvailable: true } }))
    .toMatchObject({ packages: [{ name: "pkg", fix: "更新あり" }] });
  expect(read(1, {})).toMatchObject({ status: "unavailable" });
  expect(readAuditResult({ status: null, stdout: "" }, "today")).toMatchObject({ status: "unavailable" });
});
