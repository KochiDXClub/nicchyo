import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const FRAGMENTS_DIR = path.join(ROOT_DIR, "docs", "changelog-unreleased");
const CHANGELOG_FILE = path.join(ROOT_DIR, "docs", "CHANGELOG-unreleased.md");

/**
 * Reads and collects bullet entries from fragment files.
 * @param {string} dir
 * @returns {{ file: string, lines: string[] }[]}
 */
export function collectFragments(dir = FRAGMENTS_DIR) {
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(
    (f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md"
  );

  const results = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "));

    if (lines.length > 0) {
      results.push({ file, filePath, lines });
    }
  }

  return results;
}

/**
 * Inserts new changelog lines into CHANGELOG-unreleased.md content right under '## 一覧'.
 * @param {string} changelogContent
 * @param {string[]} newLines
 * @returns {string}
 */
export function insertChangelogEntries(changelogContent, newLines) {
  if (newLines.length === 0) return changelogContent;

  const targetHeader = "## 一覧";
  const headerIndex = changelogContent.indexOf(targetHeader);

  if (headerIndex === -1) {
    // If no '## 一覧' found, append to bottom
    return changelogContent.trimEnd() + "\n\n## 一覧\n" + newLines.join("\n") + "\n";
  }

  const afterHeaderIndex = headerIndex + targetHeader.length;
  // Match any trailing newlines right after ## 一覧
  const before = changelogContent.slice(0, afterHeaderIndex);
  const after = changelogContent.slice(afterHeaderIndex);

  const formattedInsert = "\n" + newLines.join("\n");
  return before + formattedInsert + after;
}

/**
 * Main pack function.
 */
export function packChangelog(options = {}) {
  const {
    fragmentsDir = FRAGMENTS_DIR,
    changelogFile = CHANGELOG_FILE,
    dryRun = false,
    keep = false,
  } = options;

  const fragments = collectFragments(fragmentsDir);

  if (fragments.length === 0) {
    console.log("No unreleased changelog fragments found in docs/changelog-unreleased/");
    return { packedCount: 0, entriesCount: 0 };
  }

  const allLines = [];
  for (const frag of fragments) {
    allLines.push(...frag.lines);
  }

  console.log(`Found ${fragments.length} fragment(s) with ${allLines.length} entry/entries.`);

  if (dryRun) {
    console.log("[Dry Run] Would insert the following lines into docs/CHANGELOG-unreleased.md:");
    allLines.forEach((l) => console.log(`  ${l}`));
    return { packedCount: fragments.length, entriesCount: allLines.length };
  }

  const currentContent = fs.readFileSync(changelogFile, "utf-8");
  const updatedContent = insertChangelogEntries(currentContent, allLines);
  fs.writeFileSync(changelogFile, updatedContent, "utf-8");
  console.log(`Successfully packed entries into ${path.relative(ROOT_DIR, changelogFile)}.`);

  if (!keep) {
    for (const frag of fragments) {
      fs.unlinkSync(frag.filePath);
    }
    console.log(`Removed ${fragments.length} fragment file(s).`);
  }

  return { packedCount: fragments.length, entriesCount: allLines.length };
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const keep = args.includes("--keep");

  packChangelog({ dryRun, keep });
}
