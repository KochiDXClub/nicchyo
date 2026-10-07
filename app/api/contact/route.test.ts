import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const notifInsert = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "inquiries"
        ? { insert: (row: unknown) => ({ select: () => ({ single: () => insert(row) }) }) }
        : { insert: (row: unknown) => notifInsert(row) },
  }),
}));

import { POST } from "./route";

const valid = { name: "山田", email: "a@example.com", category: "sponsor", message: "協賛について教えてください" };

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://nicchyo.example/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: "https://nicchyo.example", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ data: { id: "i1" }, error: null });
  notifInsert.mockResolvedValue({ error: null });
});

describe("POST /api/contact", () => {
  it("正しい入力は保存して通知する。sponsor は日本語のラベルで通知する", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(notifInsert.mock.calls[0][0].body).toContain("協賛・支援");
  });

  it("不正な JSON は 400（500 にしない）", async () => {
    expect((await post("{not json")).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("name が文字列でない入力は 400", async () => {
    expect((await post({ ...valid, name: 123 })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("極端に長い本文は 400", async () => {
    expect((await post({ ...valid, message: "あ".repeat(6000) })).status).toBe(400);
  });

  it("別オリジンからは 403", async () => {
    expect((await post(valid, { origin: "https://evil.example" })).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("honeypot に値があれば成功を装って何も保存しない", async () => {
    const res = await post({ ...valid, website: "http://spam.example" });
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(notifInsert).not.toHaveBeenCalled();
  });
});
