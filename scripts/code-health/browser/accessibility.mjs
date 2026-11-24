import { expect, test } from "@playwright/test";
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const axeScript = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const ruleIds = ["button-name", "link-name", "label", "select-name", "image-alt"];

for (const path of ["/faq", "/privacy"]) {
  test(path, async ({ page }, info) => {
    const result = { path, viewport: info.project.name, checkedAt: new Date().toISOString(), status: "unavailable" };
    try {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.ok()).toBe(true);
      expect(new URL(page.url()).pathname).toBe(path);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await page.addScriptTag({ path: axeScript });
      const audit = await page.evaluate(ids => window.axe.run(document, {
        runOnly: { type: "rule", values: ids }, resultTypes: ["violations", "incomplete"],
      }), ruleIds);
      // 指摘が 0 件でも、axe が実際に走った証拠になる結果（通過・指摘・要確認のどれか）があることを確かめる
      expect(audit.passes.length + audit.violations.length + audit.incomplete.length).toBeGreaterThan(0);
      for (const group of ["violations", "incomplete"]) {
        result[group] = audit[group].map(rule => ({
          id: rule.id, impact: rule.impact, help: rule.help, url: rule.helpUrl,
          elements: rule.nodes.map(node => node.target),
        }));
      }
      expect(new URL(page.url()).pathname).toBe(path);
      result.status = "complete";
    } finally {
      writeFileSync(info.outputPath("result.json"), JSON.stringify(result, null, 2));
      const counts = result.status === "complete"
        ? `指摘 ${result.violations.reduce((n, v) => n + v.elements.length, 0)} 箇所 / 要確認 ${result.incomplete.reduce((n, v) => n + v.elements.length, 0)} 箇所`
        : "検査失敗";
      const line = `- ${path}（${result.viewport}） ${counts}`;
      console.info(line);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
    }
  });
}
