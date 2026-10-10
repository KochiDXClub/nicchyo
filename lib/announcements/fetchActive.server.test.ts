import { beforeEach, describe, expect, it, vi } from "vitest";

let result: { data: unknown; error: unknown };
const calls: { eq: [string, unknown][]; lte: [string, unknown][] } = { eq: [], lte: [] };

let hasClient = true;
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () =>
    !hasClient
      ? null
      : {
    from: () => {
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (calls.eq.push([c, v]), chain),
        lte: (c: string, v: unknown) => (calls.lte.push([c, v]), chain),
        order: () => chain,
        limit: async () => result,
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
    expect(Object.keys(list[0]).sort()).toEqual(["body", "endsAt", "id", "important", "startsAt", "title"]);
  });

  it("読めなかったとき・管理用クライアントが作れないときは空（ページは止めない）", async () => {
    result = { data: null, error: { code: "42P01" } };
    expect(await fetchActiveAnnouncements(NOW)).toEqual([]);
    hasClient = false;
    expect(await fetchActiveAnnouncements(NOW)).toEqual([]);
  });
});
