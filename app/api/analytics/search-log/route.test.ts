import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/collectionSettings.server", () => ({ isAnalyticsCollectionEnabled: async () => true }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));

const insert = vi.fn();
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({ from: () => ({ insert }) }),
}));

// レート制限は本物（Upstash 未設定ならメモリ）を使い、渡されたキーの材料だけを記録する
const rateLimitOptions: { bucket: string; keySuffix?: string | null }[] = [];
vi.mock("@/lib/security/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rateLimit")>();
  return {
    ...actual,
    enforceRateLimit: (request: Request, options: Parameters<typeof actual.enforceRateLimit>[1]) => {
      rateLimitOptions.push(options);
      return actual.enforceRateLimit(request, options);
    },
  };
});

import { POST } from "./route";

let ipCounter = 0;
function poster() {
  // テストごとに別の IP にして、メモリのレート制限を持ち越さない
  const ip = `203.0.113.${++ipCounter}`;
  return (keyword: string) =>
    POST(
      new Request("http://localhost/api/analytics/search-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ keyword, resultCount: 1 }),
      })
    );
}

describe("POST /api/analytics/search-log の語ごとのレート制限", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitOptions.length = 0;
    insert.mockResolvedValue({ error: null });
  });

  it("同じ IP・同じ語（大文字小文字は同じ扱い）は 3 回までで、4 回目は 429", async () => {
    const post = poster();
    for (const keyword of ["Yuzu", "yuzu", "YUZU"]) expect((await post(keyword)).status).toBe(200);
    expect((await post("yuzu")).status).toBe(429);
    // 別の語は数えない
    expect((await post("tomato")).status).toBe(200);
  });

  it("キーに生の検索語を入れない（外部の Redis に「どの IP が何を検索したか」を残さない、#1059）", async () => {
    const post = poster();
    await post("山田 090-1234-5678");
    const perKeyword = rateLimitOptions.find((o) => o.bucket === "analytics-search-log-per-keyword");
    expect(perKeyword?.keySuffix).toMatch(/^[0-9a-f]{32}$/);
    expect(perKeyword?.keySuffix).not.toContain("090");
  });
});
