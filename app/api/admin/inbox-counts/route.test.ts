import { beforeEach, describe, expect, it, vi } from "vitest";

let user: { app_metadata?: { role?: string } } | null;
const counts: Record<string, { count: number | null; error: unknown }> = {};

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({
  createAdminServiceClientOrNull: () => ({
    from: (table: string) => ({
      select: () => {
        const result = counts[table];
        const chain = { eq: () => chain, in: () => chain, then: (resolve: (v: unknown) => void) => resolve(result) };
        return chain;
      },
    }),
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  user = { app_metadata: { role: "admin" } };
  counts.admin_notifications = { count: 2, error: null };
  counts.reports = { count: 1, error: null };
  counts.inquiries = { count: 3, error: null };
});

describe("GET /api/admin/inbox-counts", () => {
  it("未読の通知・未対応の通報・未対応の問い合わせの件数を返す", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifications: 2, reports: 1, inquiries: 3 });
  });

  it("moderator 以上でなければ 403", async () => {
    user = { app_metadata: { role: "vendor" } };
    expect((await GET()).status).toBe(403);
    user = null;
    expect((await GET()).status).toBe(403);
  });

  it("数えられなかった種類は 0 にする（ほかの件数は返す）", async () => {
    counts.reports = { count: null, error: { message: "x" } };
    expect(await (await GET()).json()).toEqual({ notifications: 2, reports: 0, inquiries: 3 });
  });
});
