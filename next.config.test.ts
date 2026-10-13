import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const nextConfig = createRequire(import.meta.url)("./next.config.js") as {
  redirects: () => Promise<{ source: string; destination: string; permanent: boolean }[]>;
};

describe("next.config redirects", () => {
  it("Discord 通知の旧リンク /reports/:date を管理画面のレポートへ転送する", async () => {
    const redirects = await nextConfig.redirects();
    expect(redirects).toContainEqual({
      source: "/reports/:date",
      destination: "/admin/security-reports/:date",
      permanent: false,
    });
  });
});
