import { describe, expect, it } from "vitest";
import { safeJsonLd } from "./jsonLd";

describe("safeJsonLd", () => {
  it("通常の値は JSON.parse で元に戻る", () => {
    const data = { name: "日曜市 001番", "@type": "LocalBusiness" };
    const serialized = safeJsonLd(data);
    expect(JSON.parse(serialized)).toEqual(data);
  });

  it("`<` を含む文字列で script タグを閉じられない", () => {
    const data = {
      name: "</script><script>alert(1)</script>",
    };
    const serialized = safeJsonLd(data);
    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<");
    // エスケープ後も JSON として妥当で、値は保持される
    expect(JSON.parse(serialized).name).toBe(
      "</script><script>alert(1)</script>",
    );
  });

  it("`<` `>` `&` をすべて Unicode エスケープする", () => {
    const serialized = safeJsonLd({ v: "a<b>c&d" });
    expect(serialized).toContain("\\u003c");
    expect(serialized).toContain("\\u003e");
    expect(serialized).toContain("\\u0026");
    expect(serialized).not.toMatch(/[<>&]/);
  });
});
