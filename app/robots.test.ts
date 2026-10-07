import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  const rules = robots().rules as { disallow: string[] };

  it("末尾スラッシュなしでも /analysis 自体を拒否する（前方一致で配下も拒否される）", () => {
    expect(rules.disallow).toContain("/analysis");
    expect(rules.disallow).not.toContain("/analysis/");
  });

  it("管理・出店者・非公開系のパスをすべて拒否する", () => {
    for (const path of ["/admin", "/vendor", "/my-shop", "/api", "/private", "/reports", "/oauth"]) {
      expect(rules.disallow).toContain(path);
    }
  });
});
