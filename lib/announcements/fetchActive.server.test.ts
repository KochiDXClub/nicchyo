import { beforeEach, describe, expect, it, vi } from "vitest";

let result: { data: unknown; error: unknown };
let results: { data: unknown; error: unknown }[] = [];
const selectCalls: string[] = [];
const calls: { eq: [string, unknown][]; lte: [string, unknown][] } = { eq: [], lte: [] };

let hasClient = true;
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () =>
    !hasClient
      ? null
      : {
    from: () => {
      const chain = {
        select: (columns: string) => (selectCalls.push(columns), chain),
        eq: (c: string, v: unknown) => (calls.eq.push([c, v]), chain),
        lte: (c: string, v: unknown) => (calls.lte.push([c, v]), chain),
        order: () => chain,
        limit: async () => results.shift() ?? result,
      };
      return chain;
    },
  },
}));

import { fetchActiveAnnouncements } from "./fetchActive.server";

const NOW = new Date("2026-10-12T03:00:00Z");
const row = (o: Record<string, unknown>) => ({
  id: "id",
  title: "t",
  body: "b",
  important: false,
  published: true,
  starts_at: "2026-10-10T00:00:00Z",
  ends_at: null,
  created_at: "2026-10-10T00:00:00Z",
  updated_at: "2026-10-10T00:00:00Z",
  ...o,
});

beforeEach(() => {
  calls.eq.length = 0;
  calls.lte.length = 0;
  hasClient = true;
  results = [];
  result = { data: [], error: null };
});

describe("fetchActiveAnnouncements", () => {
  it("公開にしてあって、開始済みのものだけを問い合わせる", async () => {
    await fetchActiveAnnouncements(NOW);
    expect(calls.eq).toContainEqual(["published", true]);
    expect(calls.lte).toContainEqual(["starts_at", NOW.toISOString()]);
  });

  it("終了したものを除き、重要を先に・新しい順にして、来訪者に見せる項目だけを返す", async () => {
    result = {
      data: [
        row({ id: "ended", ends_at: "2026-10-11T00:00:00Z" }),
        row({ id: "old", starts_at: "2026-10-01T00:00:00Z" }),
        row({ id: "new", starts_at: "2026-10-11T00:00:00Z" }),
        row({ id: "imp", important: true, starts_at: "2026-09-01T00:00:00Z" }),
      ],
      error: null,
    };
    const list = await fetchActiveAnnouncements(NOW);
    expect(list.map((a) => a.id)).toEqual(["imp", "new", "old"]);
    expect(Object.keys(list[0]).sort()).toEqual(["body", "endsAt", "id", "important", "lang", "startsAt", "title"]);
  });

  it("英語のロケールでは、英語版があるお知らせだけ英語で返す（無ければ日本語のまま）", async () => {
    result = {
      data: [
        row({ id: "both", title: "雨天中止", body: "中止です", title_en: "Cancelled", body_en: "Cancelled due to rain" }),
        row({ id: "ja-only", starts_at: "2026-10-09T00:00:00Z" }),
        row({ id: "half", starts_at: "2026-10-08T00:00:00Z", title_en: "Only title", body_en: null }),
      ],
      error: null,
    };
    const en = await fetchActiveAnnouncements(NOW, "en");
    expect(en.map((a) => [a.id, a.title, a.lang])).toEqual([
      ["both", "Cancelled", "en"],
      ["ja-only", "t", "ja"],
      ["half", "t", "ja"],
    ]);
    const ja = await fetchActiveAnnouncements(NOW);
    expect(ja[0]).toMatchObject({ title: "雨天中止", body: "中止です", lang: "ja" });
  });

  it("英語版の列を足すマイグレーションの前でも、日本語のお知らせは返す", async () => {
    selectCalls.length = 0;
    result = { data: null, error: { code: "42703" } };
    const original = result;
    // 1回目は列が無いエラー、2回目は日本語の列だけで成功
    results = [original, { data: [row({ id: "x" })], error: null }];
    const list = await fetchActiveAnnouncements(NOW, "en");
    expect(list.map((a) => a.id)).toEqual(["x"]);
    expect(selectCalls[0]).toContain("title_en");
    expect(selectCalls[1]).not.toContain("title_en");
  });

  it("読めなかったとき・管理用クライアントが作れないときは空（ページは止めない）", async () => {
    result = { data: null, error: { code: "42P01" } };
    expect(await fetchActiveAnnouncements(NOW)).toEqual([]);
    hasClient = false;
    expect(await fetchActiveAnnouncements(NOW)).toEqual([]);
  });
});
