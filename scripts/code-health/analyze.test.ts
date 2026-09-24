import { describe, expect, it } from "vitest";
import { analyze, classifyKind, classifyRole, detectClones, significantLines } from "./analyze.mjs";
import { diffReports, diffToMarkdown } from "./diff.mjs";

// 8行以上・200文字以上の塊だけをコピペとみなすので、それを超える長さの同じ処理を用意する
const SHARED_BLOCK = Array.from(
  { length: 10 },
  (_, i) => `  const value${i} = computeSomethingMeaningful(input.field${i}, options.threshold${i});`
).join("\n");

describe("分類", () => {
  it("種類を見分ける", () => {
    expect(classifyKind("lib/foo.test.ts", "")).toBe("test");
    expect(classifyKind("tests/vitest.setup.ts", "")).toBe("test");
    expect(classifyKind("types/database.types.ts", "")).toBe("generated");
    expect(classifyKind("app/(public)/map/data/shops.ts", "")).toBe("data");
    expect(classifyKind("app/(public)/map/components/intro/introDemoShops.ts", "")).toBe("data");
    expect(classifyKind("lib/shopImages.ts", "export const a = 1;")).toBe("own");
  });

  it("機能を見分ける", () => {
    expect(classifyRole("app/(public)/map/page.tsx", "own")).toBe("page");
    expect(classifyRole("app/(public)/map/components/MapView.tsx", "own")).toBe("page-ui");
    expect(classifyRole("app/(public)/map/services/shopDb.ts", "own")).toBe("page-logic");
    expect(classifyRole("app/api/shops/route.ts", "own")).toBe("api");
    expect(classifyRole("proxy.ts", "own")).toBe("api");
    expect(classifyRole("components/ui/button.tsx", "own")).toBe("shared-ui");
    expect(classifyRole("lib/shopImages.ts", "own")).toBe("shared-logic");
    expect(classifyRole("utils/supabase/server.ts", "own")).toBe("shared-logic");
    expect(classifyRole("lib/foo.test.ts", "test")).toBe("test");
  });
});

describe("significantLines", () => {
  it("コメント・import・閉じ括弧だけの行は数えない", () => {
    const lines = significantLines(
      ['"use client";', 'import { a } from "b";', "// comment", "/* block", " still */", "const x = 1;", "  }", "</div>", "return x;"].join("\n")
    );
    expect(lines.map((l) => l.text)).toEqual(["const x = 1;", "return x;"]);
    expect(lines.map((l) => l.line)).toEqual([6, 9]);
  });
});

describe("detectClones", () => {
  it("別ファイルにある同じ塊を見つけ、行番号を返す", () => {
    const { blocks, dupLinesByFile } = detectClones([
      { path: "app/a.ts", content: `export function a() {\n${SHARED_BLOCK}\n}` },
      { path: "app/b.ts", content: `// b\nexport function b() {\n${SHARED_BLOCK}\n}` },
      { path: "app/c.ts", content: "export const c = 1;" },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].a).toMatchObject({ path: "app/a.ts", start: 2, end: 11 });
    expect(blocks[0].b).toMatchObject({ path: "app/b.ts", start: 3, end: 12 });
    expect(dupLinesByFile.get("app/a.ts")).toBe(10);
    expect(dupLinesByFile.get("app/c.ts")).toBe(0);
  });

  it("短い塊はコピペとみなさない", () => {
    const short = "const a = 1;\nconst b = 2;";
    const { blocks } = detectClones([
      { path: "app/a.ts", content: short },
      { path: "app/b.ts", content: short },
    ]);
    expect(blocks).toHaveLength(0);
  });
});

describe("analyze", () => {
  it("ルールの例外（共通基盤そのもの）は数えず、hex は大文字小文字を区別しない", () => {
    const report = analyze([
      { path: "lib/supabase/adminClient.ts", content: 'import { createClient } from "@supabase/supabase-js";' },
      { path: "app/api/x/route.ts", content: 'import { createClient } from "@supabase/supabase-js";' },
      { path: "app/x/page.tsx", content: 'const a = "#FFFFFF"; const b = "#ffffff"; const c = "#123abc";' },
    ]);
    expect(report.rules.directSupabaseClient.files.map((f) => f.path)).toEqual(["app/api/x/route.ts"]);
    expect(report.rules.rawHex.value).toBe(2);
  });

  it("共通化率はアプリ本体のうち lib/・components/ の割合", () => {
    const report = analyze([
      { path: "lib/a.ts", content: "const a = 1;" },
      { path: "app/x/page.tsx", content: "const a = 1;\nconst b = 2;\nconst c = 3;" },
      { path: "lib/a.test.ts", content: "const a = 1;\nconst b = 2;" },
    ]);
    expect(report.metrics.sharedRatio).toBe(25);
  });
});

describe("diffReports", () => {
  const base = [
    { path: "app/x/page.tsx", content: "export default function Page() { return null; }" },
    { path: "lib/a.ts", content: "export const a = 1;" },
  ];

  it("変更がなければ悪化なし", () => {
    const diff = diffReports(analyze(base), analyze(base));
    expect(diff.failed).toBe(false);
    expect(diff.changedFiles).toHaveLength(0);
  });

  it("変更したファイルでルール違反が増えたら悪化として場所と値を示す", () => {
    const after = [
      { path: "app/x/page.tsx", content: 'export default function Page() { return <div className="text-slate-500" style={{ color: "#abcdef" }} />; }' },
      { path: "lib/a.ts", content: "export const a = 1;" },
    ];
    const diff = diffReports(analyze(base), analyze(after));
    expect(diff.failed).toBe(true);
    expect(diff.ruleRegressions.map((r) => r.rule).sort()).toEqual(["neutralPalette", "rawHex"]);
    expect(diff.ruleRegressions.find((r) => r.rule === "rawHex")?.newValues).toEqual(["#abcdef"]);
    expect(diffToMarkdown(diff)).toContain("`app/x/page.tsx` 生の hex カラー（種類）: 0 → 1");
  });

  it("新しいファイルでコピペが増えたら相手の場所を示す", () => {
    const withBlock = [...base, { path: "app/y/a.ts", content: `export function a() {\n${SHARED_BLOCK}\n}` }];
    const after = [...withBlock, { path: "app/z/b.ts", content: `export function b() {\n${SHARED_BLOCK}\n}` }];
    const diff = diffReports(analyze(withBlock), analyze(after));
    expect(diff.failed).toBe(true);
    expect(diff.duplicationRegressions[0].path).toBe("app/z/b.ts");
    expect(diff.duplicationRegressions[0].partners[0].other.path).toBe("app/y/a.ts");
  });
});
