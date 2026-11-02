import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();
const limit = vi.fn();

/** select から先の呼び出し（gte / in / order / limit）を記録する。await すると件数つきの結果を返す */
type Call = { method: string; args: unknown[] };
const queries: { head: boolean; calls: Call[] }[] = [];
function builder(head: boolean) {
  const q = { head, calls: [] as Call[] };
  queries.push(q);
  const chain = {
    gte: (...args: unknown[]) => (q.calls.push({ method: "gte", args }), chain),
    in: (...args: unknown[]) => (q.calls.push({ method: "in", args }), chain),
    order: (...args: unknown[]) => (q.calls.push({ method: "order", args }), chain),
    limit: (n: number) => (q.calls.push({ method: "limit", args: [n] }), limit(n)),
    then: (resolve: (v: unknown) => void) => resolve({ count: 7, error: null }),
  };
  return chain;
}
const listQuery = () => queries.find((q) => !q.head)!;

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => insert(row),
      select: (_cols: string, opts?: { head?: boolean }) => builder(Boolean(opts?.head)),
    }),
  }),
}));

import { GET, POST } from "./route";

const asRole = (role: string) =>
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@example.com", app_metadata: { role } } } });

function post(body: string) {
  return POST(
    new Request("http://localhost/api/admin/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
  );
}

describe("/api/admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.length = 0;
    insert.mockResolvedValue({ error: null });
    limit.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it("moderator は監査ログを読めない（RLS と同じく admin だけ）", async () => {
    asRole("moderator");
    const res = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(res.status).toBe(403);
    expect(limit).not.toHaveBeenCalled();
  });

  it("moderator は監査ログを書けない", async () => {
    asRole("moderator");
    const res = await post(JSON.stringify({ action: "x" }));
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("admin は読める。limit は 1〜1000 に丸める", async () => {
    asRole("admin");
    expect((await GET(new Request("http://localhost/api/admin/audit-logs?limit=-5"))).status).toBe(200);
    expect(limit).toHaveBeenLastCalledWith(1);
    await GET(new Request("http://localhost/api/admin/audit-logs?limit=99999"));
    expect(limit).toHaveBeenLastCalledWith(1000);
  });

  it("admin でも壊れた JSON は 400 で返す", async () => {
    asRole("admin");
    const res = await post("{");
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("期間とロールは DB で絞る（読み込む上限より古い記録も出せるように）", async () => {
    asRole("admin");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T03:00:00Z")); // 日本時間 12:00
    await GET(new Request("http://localhost/api/admin/audit-logs?period=today&role=admin"));
    vi.useRealTimers();

    expect(listQuery().calls).toEqual([
      { method: "gte", args: ["created_at", "2026-10-17T00:00:00+09:00"] },
      { method: "in", args: ["actor_role", ["admin", "super_admin"]] },
      { method: "order", args: ["created_at", { ascending: false }] },
      { method: "limit", args: [500] },
    ]);
  });

  it("30日間は今から30日さかのぼる。絞り込まなければ gte も in も付けない", async () => {
    asRole("admin");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T03:00:00Z"));
    await GET(new Request("http://localhost/api/admin/audit-logs?period=month&role=moderator"));
    expect(listQuery().calls.slice(0, 2)).toEqual([
      { method: "gte", args: ["created_at", "2026-09-17T03:00:00.000Z"] },
      { method: "in", args: ["actor_role", ["moderator"]] },
    ]);

    queries.length = 0;
    await GET(new Request("http://localhost/api/admin/audit-logs"));
    vi.useRealTimers();
    expect(listQuery().calls.map((c) => c.method)).toEqual(["order", "limit"]);
  });

  it("件数のまとめは絞り込みに関係なく全体から数えて返す", async () => {
    asRole("admin");
    limit.mockResolvedValue({ data: [{ id: 1 }], count: 3, error: null });
    const res = await GET(new Request("http://localhost/api/admin/audit-logs?period=week"));
    expect(await res.json()).toEqual({
      logs: [{ id: 1 }],
      total: 3,
      stats: { total: 7, today: 7, admin: 7, moderator: 7 },
    });
    // まとめの4本は件数だけ（行は取らない）。期間の絞り込みはまとめに付けない
    const heads = queries.filter((q) => q.head);
    expect(heads).toHaveLength(4);
    expect(heads.map((q) => q.calls.map((c) => c.method).join(","))).toEqual(["", "gte", "in", "in"]);
  });

  it("知らない期間・ロールは 400 で返す", async () => {
    asRole("admin");
    expect((await GET(new Request("http://localhost/api/admin/audit-logs?period=year"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/admin/audit-logs?role=vendor"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/admin/audit-logs?role=toString"))).status).toBe(400);
    expect(limit).not.toHaveBeenCalled();
  });
});
