import { describe, expect, it } from "vitest";
import { inspectAdminHandlers } from "./admin-handlers.mjs";
import { analyze } from "./analyze.mjs";
import { diffReports } from "./diff.mjs";

describe("診断の根拠", () => {
  it("同じルート内でも操作単位で共通ガードと要確認を区別する", () => {
    const source = [
      'import { requireAdminApi as guard } from "@/lib/auth/requireAdminApi";',
      'export async function GET() { const auth = await guard(); if ("error" in auth) return auth.error; }',
      'export const POST = async () => { await write(); await guard(); };',
      'export { remove as DELETE };',
    ].join("\n");
    expect(inspectAdminHandlers("route.ts", source).map(h => [h.method, h.guardLine]))
      .toEqual([["GET", 2], ["POST", null], ["DELETE", null]]);
  });

  it("行移動を除き、総数が同じでも変更行の指摘を報告する", () => {
    const measure = (content: string) => analyze([{ path: "app/example/page.tsx", content }]);
    const before = measure("text-slate-400\nbg-gray-200");
    const after = measure("\ntext-slate-400\nbg-gray-300");
    expect(diffReports(before, after).introduced).toMatchObject([{ line: 3 }]);
  });
});
