import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// purge_expired_personal_data を create or replace するたびに、前の版の処理を落としていないかを
// SQL の文面で確かめる（ローカルに Postgres が無くても CI で回せる静的チェック）。
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const PREVIOUS = readFileSync(join(MIGRATIONS, "20260930150000_create_vendor_help_logs.sql"), "utf-8");
const LATEST = readFileSync(join(MIGRATIONS, "20261007110000_privacy_retention_purge.sql"), "utf-8");

/** 関数本体の中の SQL 文（update / delete / perform）を、空白をそろえて取り出す */
function purgeStatements(sql: string): string[] {
  const start = sql.indexOf("create or replace function public.purge_expired_personal_data");
  const code = sql
    .slice(start)
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return (code.match(/(?:update|delete from|perform)\s[^;]+;/g) ?? []).map((s) => s.replace(/\s+/g, " ").trim());
}

describe("20261007110000_privacy_retention_purge.sql", () => {
  it("前の版の purge 処理を1つも落としていない", () => {
    const previous = purgeStatements(PREVIOUS);
    const latest = purgeStatements(LATEST);
    expect(previous.length).toBeGreaterThan(8);
    for (const statement of previous) expect(latest).toContain(statement);
  });

  it("AI相談への評価・通報の自由記述・未対応の問い合わせ/通報の保持期限を足している", () => {
    const latest = purgeStatements(LATEST).join("\n");
    expect(latest).toContain(
      "update public.ai_consult_feedback set question_text = null, turn_text = null, comment = null"
    );
    expect(latest).toMatch(
      /update public\.reports set reporter_email = null, details = null .*created_at < now\(\) - interval '365 days'/
    );
    expect(latest).toMatch(
      /update public\.inquiries set email = null, name = null where \(email is not null or name is not null\) and created_at < now\(\) - interval '365 days'/
    );
    expect(latest).toContain("delete from public.vendor_help_logs where created_at < now() - interval '180 days'");
  });

  it("security definer のまま、anon / authenticated から直接実行できない", () => {
    expect(LATEST).toMatch(/security definer\s+set search_path = public/);
    for (const role of ["public", "anon", "authenticated"]) {
      expect(LATEST).toContain(`revoke execute on function public.purge_expired_personal_data() from ${role};`);
    }
  });
});
