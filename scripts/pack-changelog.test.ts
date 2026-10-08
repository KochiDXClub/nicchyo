import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  collectFragments,
  insertChangelogEntries,
  packChangelog,
} from "./pack-changelog.mjs";

describe("pack-changelog", () => {
  describe("collectFragments", () => {
    it("returns empty array for non-existent directory", () => {
      expect(collectFragments("/non/existent/path")).toEqual([]);
    });
  });

  describe("insertChangelogEntries", () => {
    it("inserts entries right under ## 一覧", () => {
      const base = "# Title\n\n## 一覧\n- Old Entry (#1)\n";
      const newLines = ["- New Entry (#2)", "- Another Entry (#3)"];
      const result = insertChangelogEntries(base, newLines);

      expect(result).toBe(
        "# Title\n\n## 一覧\n- New Entry (#2)\n- Another Entry (#3)\n- Old Entry (#1)\n"
      );
    });

    it("handles empty newLines without changing content", () => {
      const base = "# Title\n\n## 一覧\n- Old Entry (#1)\n";
      expect(insertChangelogEntries(base, [])).toBe(base);
    });

    it("appends to bottom if ## 一覧 is missing", () => {
      const base = "# Title\nNo header here";
      const newLines = ["- New Entry (#2)"];
      const result = insertChangelogEntries(base, newLines);

      expect(result).toContain("## 一覧\n- New Entry (#2)\n");
    });
  });

  describe("collectFragments and packChangelog end-to-end", () => {
    it("collects fragments and packs them into target file, then deletes fragments", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-test-"));
      const fragmentsDir = path.join(tempDir, "fragments");
      fs.mkdirSync(fragmentsDir);

      // Create README.md (should be ignored)
      fs.writeFileSync(path.join(fragmentsDir, "README.md"), "# README\n- Do not pack me\n");

      // Create fragment 1
      fs.writeFileSync(
        path.join(fragmentsDir, "644-ai-fallback.md"),
        "- AI相談のフォールバックを追加 (#644)\n"
      );

      // Create fragment 2
      fs.writeFileSync(
        path.join(fragmentsDir, "643-github-links.md"),
        "- GitHubへのリンクを追加 (#643)\n"
      );

      // Create dummy changelog file
      const changelogFile = path.join(tempDir, "CHANGELOG-unreleased.md");
      fs.writeFileSync(changelogFile, "# 未リリースの変更\n\n## 一覧\n- 既存の項目 (#100)\n");

      // Run packChangelog
      const result = packChangelog({ fragmentsDir, changelogFile });
      expect(result.packedCount).toBe(2);
      expect(result.entriesCount).toBe(2);

      // Verify changelog content
      const updated = fs.readFileSync(changelogFile, "utf-8");
      expect(updated).toContain("- AI相談のフォールバックを追加 (#644)");
      expect(updated).toContain("- GitHubへのリンクを追加 (#643)");
      expect(updated).toContain("- 既存の項目 (#100)");

      // Verify fragments are deleted but README is kept
      expect(fs.existsSync(path.join(fragmentsDir, "README.md"))).toBe(true);
      expect(fs.existsSync(path.join(fragmentsDir, "644-ai-fallback.md"))).toBe(false);
      expect(fs.existsSync(path.join(fragmentsDir, "643-github-links.md"))).toBe(false);

      // Cleanup tempDir
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
