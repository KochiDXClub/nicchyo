import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts/ci/pending-migrations.sh");

function run(dryRunOutput: string) {
  const dir = mkdtempSync(join(tmpdir(), "pending-migrations-"));
  const migrations = join(dir, "migrations");
  mkdirSync(migrations);
  writeFileSync(join(migrations, "20260101000000_add_table.sql"), "select 1;");
  const input = join(dir, "dry-run.txt");
  const out = join(dir, "pending.txt");
  writeFileSync(input, dryRunOutput);
  const result = spawnSync("bash", [script, input, out], {
    env: { ...process.env, MIGRATIONS_DIR: migrations },
    encoding: "utf8",
  });
  return { ...result, list: readFileSync(out, "utf8") };
}

describe("pending-migrations.sh", () => {
  it("未適用ファイルを拾えたら一覧とハッシュを返す", () => {
    const r = run("Would push these migrations:\n • 20260101000000_add_table.sql\n");
    expect(r.status).toBe(0);
    expect(r.list).toBe("20260101000000_add_table.sql\n");
    expect(r.stdout.trim()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("「最新です」と確認できたときだけ 0 件(none)にする", () => {
    const r = run("Remote database is up to date.\n");
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("none");
    expect(r.list).toBe("");
  });

  it("何も拾えず「最新です」とも読めない出力は失敗にする（黙って 0 件扱いにしない）", () => {
    for (const output of ["", "予期しない出力\n"]) {
      const r = run(output);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("読み取れませんでした");
    }
  });
});
