import { spawnSync } from "node:child_process";

const severities = ["critical", "high", "moderate", "low", "info"];

export function readAuditResult(run, checkedAt) {
  try {
    const data = JSON.parse(run.stdout);
    if (run.error || ![0, 1].includes(run.status) || data.error || data.auditReportVersion !== 2 ||
        !data.vulnerabilities || !Number.isInteger(data.metadata?.vulnerabilities?.total)) throw new Error();
    const packages = Object.values(data.vulnerabilities).map(item => {
      if (typeof item.name !== "string" || !severities.includes(item.severity) || !Array.isArray(item.via)) throw new Error();
      return {
        name: item.name, severity: item.severity, range: item.range,
        fix: typeof item.fixAvailable === "object" && item.fixAvailable
          ? `${item.fixAvailable.name}@${item.fixAvailable.version}${item.fixAvailable.isSemVerMajor ? "（メジャー更新）" : ""}`
          : item.fixAvailable ? "更新あり" : "更新案なし",
        advisories: item.via.map(v => typeof v === "string" ? { title: `依存先 ${v}` } :
          { title: v.title, url: /^https:\/\//.test(v.url) ? v.url : undefined }),
      };
    }).sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity) || a.name.localeCompare(b.name));
    if (packages.length !== data.metadata.vulnerabilities.total || (run.status === 1 && !packages.length)) throw new Error();
    return { status: "complete", checkedAt, packages };
  } catch {
    return { status: "unavailable", checkedAt };
  }
}

export function auditDependencies() {
  const run = spawnSync("npm", ["audit", "--omit=dev", "--package-lock-only", "--json", "--fetch-retries=0"], {
    encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
  });
  return readAuditResult(run, new Date().toISOString());
}
