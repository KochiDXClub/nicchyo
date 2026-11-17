import { beforeEach, describe, expect, it, vi } from "vitest";

const isEnabled = vi.fn();
vi.mock("@/lib/analytics/collectionSettings.server", () => ({ isAnalyticsCollectionEnabled: () => isEnabled() }));
const getDictionary = vi.fn();
vi.mock("@/lib/analytics/searchTermDictionary.server", () => ({ getSearchTermDictionary: () => getDictionary() }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));

const insert = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({ from: () => ({ insert }), rpc }),
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
    isEnabled.mockResolvedValue(true);
    insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
    getDictionary.mockResolvedValue(["ゆず", "山田農園"]);
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

describe("POST /api/analytics/search-log の search_term_daily への二重書き込み", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEnabled.mockResolvedValue(true);
    insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
    getDictionary.mockResolvedValue(["ゆず", "山田農園"]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("従来の product_search_logs への書き込みに加えて、カタログにある語は正規化して数える", async () => {
    const res = await poster()("ユズ");
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ keyword: "ユズ", result_count: 1 });
    expect(rpc).toHaveBeenCalledWith("increment_search_term_daily", { p_term: "ゆず" });
  });

  it("カタログにない語（名前・電話番号など）は語を渡さず、匿名の 1 件（NULL）として数える", async () => {
    const res = await poster()("090-1234-5678");
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ keyword: "090-1234-5678", result_count: 1 });
    expect(rpc).toHaveBeenCalledWith("increment_search_term_daily", { p_term: null });
  });

  it("数える RPC が失敗しても 200 で、従来の書き込みは済んでいる", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    const res = await poster()("ゆず");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("RPC が例外を投げても、辞書が読めなくても、200 のまま", async () => {
    rpc.mockRejectedValueOnce(new Error("network"));
    expect((await poster()("ゆず")).status).toBe(200);

    getDictionary.mockRejectedValueOnce(new Error("catalog unavailable"));
    expect((await poster()("ゆず")).status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("従来の書き込みが失敗したら 500 で、数えない", async () => {
    insert.mockResolvedValue({ error: { message: "insert failed" } });
    expect((await poster()("ゆず")).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("収集を止めている（トグル OFF）ときは、どちらにも書かない", async () => {
    isEnabled.mockResolvedValue(false);
    const res = await poster()("ゆず");
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(getDictionary).not.toHaveBeenCalled();
  });
});
